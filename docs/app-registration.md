# Microsoft Entra ID App Registration Guide

This guide walks through creating and configuring the Microsoft Entra ID app registration for the RentAVehicle application. The app registration provides the identity foundation for Graph API access (calendars, email, Teams notifications), SPFx token acquisition via `AadHttpClient`, and Azure Functions authentication via Easy Auth.

## Prerequisites

- Microsoft 365 tenant with Global Administrator or Application Administrator access
- SharePoint Administrator role (for API permission approval)
- Access to the [Microsoft Entra admin center](https://entra.microsoft.com)

## Step 1: Create the App Registration

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com).
2. Navigate to **Identity** > **Applications** > **App registrations**.
3. Click **New registration**.
4. Configure the registration:
   - **Name:** `RentAVehicle-API`
   - **Supported account types:** Accounts in this organizational directory only (Single tenant)
   - **Redirect URI:** Leave blank (not needed for application-level permissions)
5. Click **Register**.
6. On the overview page, copy and save:
   - **Application (client) ID** -- you will need this for environment variables and SPFx configuration
   - **Directory (tenant) ID** -- you will need this for environment variables

## Step 2: Configure API Permissions

The application uses **Application permissions** (not Delegated) because Azure Functions calls the Graph API with its own identity, not on behalf of a signed-in user.

1. In the app registration, navigate to **API permissions**.
2. Click **Add a permission** > **Microsoft Graph** > **Application permissions**.
3. Add the following four permissions:

| Permission | Type | Purpose |
|---|---|---|
| `Calendars.ReadWrite` | Application | Create and update calendar events on vehicle resource mailbox calendars and employee personal calendars |
| `Mail.Send` | Application | Send booking confirmation emails via Graph `sendMail` API |
| `User.Read.All` | Application | Read user profiles for location sync from Entra ID `officeLocation` field and look up employee managers |
| `TeamsActivity.Send` | Application | Send Teams activity feed notifications for booking confirmations, reminders, and overdue alerts |

4. After adding all four permissions, click **Grant admin consent for [your tenant]**.

> [!NOTE]
> Application permissions require admin consent. All four permissions must show a green checkmark under the "Status" column after granting consent. If you see "Not granted for [tenant]", click the **Grant admin consent** button and confirm.

## Step 3: Expose an API

This step configures the app registration so that the SPFx web part can acquire tokens via `AadHttpClient`. Without this configuration, `AadHttpClient` calls from the SharePoint-hosted web part will fail silently or return 401 errors.

1. Navigate to **Expose an API**.
2. Click **Set** next to **Application ID URI**. Accept the default value:
   ```
   api://<your-client-id>
   ```
3. Click **Add a scope** and configure:
   - **Scope name:** `user_impersonation`
   - **Who can consent:** Admins only
   - **Admin consent display name:** Access RentAVehicle API
   - **Admin consent description:** Allows the SharePoint web part to call the RentAVehicle API on behalf of the signed-in user
   - **State:** Enabled
4. Click **Add scope**.
5. Under **Authorized client applications**, click **Add a client application**:
   - **Client ID:** `00000003-0000-0ff1-ce00-000000000000` (this is the SharePoint Online Client Extensibility Web Application Principal)
   - Check the `user_impersonation` scope
6. Click **Add application**.

> [!WARNING]
> If you skip the "Expose an API" configuration, the SPFx `AadHttpClient` will fail with the error: "An OAuth permission with the scope user_impersonation could not be found." This is one of the most common deployment issues.

## Step 4: Create a Client Secret

The Azure Functions backend uses `ClientSecretCredential` from `@azure/identity` to authenticate with the Graph API during local development. In production, you can use Managed Identity instead.

1. Navigate to **Certificates & secrets**.
2. Under **Client secrets**, click **New client secret**.
3. Configure:
   - **Description:** `RentAVehicle API secret`
   - **Expires:** Choose an appropriate expiration period (recommended: 12 months or 24 months)
4. Click **Add**.
5. **Copy the secret value immediately.** It will not be shown again after you leave this page.

> [!TIP]
> The secret value maps to the `AZURE_CLIENT_SECRET` environment variable. In production on Azure Functions, consider using Managed Identity (`DefaultAzureCredential`) instead of a client secret -- the code automatically detects which credential to use.

## Step 5: Configure App Roles

App roles enable role-based access control in the RentAVehicle application. The API middleware resolves the user's effective role from the `x-ms-client-principal` header injected by Azure App Service Authentication (Easy Auth).

The application uses the following role hierarchy (highest privilege first):

| Role | Privilege Level | Purpose |
|---|---|---|
| `SuperAdmin` | 3 (highest) | Full system administration |
| `Admin` | 2 | Fleet and booking management, vehicle administration |
| `Manager` | 1 | View team bookings, receive manager notifications |
| `Employee` | 0 (default) | Book vehicles, view own bookings |

To create each role:

1. Navigate to **App roles**.
2. Click **Create app role** for each role:

   **Role 1 -- Admin:**
   - Display name: `Admin`
   - Allowed member types: Users/Groups
   - Value: `Admin`
   - Description: Fleet and booking management

   **Role 2 -- Manager:**
   - Display name: `Manager`
   - Allowed member types: Users/Groups
   - Value: `Manager`
   - Description: View team bookings and receive booking alerts

   **Role 3 -- Employee:**
   - Display name: `Employee`
   - Allowed member types: Users/Groups
   - Value: `Employee`
   - Description: Book vehicles and manage own bookings

3. To assign roles to users, navigate to **Enterprise applications** > **RentAVehicle-API** > **Users and groups** > **Add user/group**.

> [!NOTE]
> If a user has no role assigned, the API middleware defaults to `Employee`. Users with multiple roles are resolved to their highest-privilege role.

## Step 6: Configure Azure Functions Easy Auth

Azure App Service Authentication (Easy Auth) handles user authentication for the Azure Functions API. It injects an `x-ms-client-principal` header into every request, which the API middleware decodes to extract user identity and role claims.

1. In the [Azure Portal](https://portal.azure.com), navigate to your **Function App**.
2. Go to **Settings** > **Authentication**.
3. Click **Add identity provider**.
4. Select **Microsoft** as the identity provider.
5. Configure:
   - **App registration type:** Provide the details of an existing app registration
   - **Application (client) ID:** Enter the Application (client) ID from Step 1 (the same `RentAVehicle-API` app registration)
   - **Issuer URL:** `https://login.microsoftonline.com/<your-tenant-id>/v2.0`
   - **Restrict access:** Require authentication
   - **Unauthenticated requests:** Return 401 Unauthorized
6. Click **Add**.

> [!TIP]
> Easy Auth injects the `x-ms-client-principal` header as a Base64-encoded JSON payload containing user claims. The API's `auth.ts` middleware decodes this to extract `userId` (from `oid` claim), `email`, `displayName`, and app role assignments. No authentication code runs in the Azure Function itself -- Easy Auth handles it at the platform level.

## Step 7: Environment Variables

Configure these environment variables in your Azure Functions application settings (or in `local.settings.json` for local development). The variable names are extracted from the project's `local.settings.template.json`.

### Azure Functions Runtime

| Name | Description | Where to Find |
|---|---|---|
| `AzureWebJobsStorage` | Azure Storage connection string for Functions runtime | Azure Portal > Storage Account > Access keys |
| `FUNCTIONS_WORKER_RUNTIME` | Set to `node` | Static value |

### Identity and Authentication

| Name | Description | Where to Find |
|---|---|---|
| `AZURE_TENANT_ID` | Directory (tenant) ID | Entra admin center > App registrations > RentAVehicle-API > Overview |
| `AZURE_CLIENT_ID` | Application (client) ID | Entra admin center > App registrations > RentAVehicle-API > Overview |
| `AZURE_CLIENT_SECRET` | Client secret value (local dev only) | Created in Step 4. In production, use Managed Identity instead |

### Database

| Name | Description | Where to Find |
|---|---|---|
| `AZURE_SQL_SERVER` | SQL Server hostname | Azure Portal > SQL Server > Overview, or `localhost` for local dev |
| `AZURE_SQL_DATABASE` | Database name: `RentAVehicle` | Static value |
| `AZURE_SQL_PORT` | SQL Server port: `1433` | Static value (default) |
| `AZURE_SQL_USER` | SQL Server username | Azure Portal > SQL Server > SQL admin credentials |
| `AZURE_SQL_PASSWORD` | SQL Server password | Azure Portal > SQL Server > SQL admin credentials |

### Notifications

| Name | Description | Where to Find |
|---|---|---|
| `NOTIFICATION_SENDER_EMAIL` | Licensed mailbox email for sending booking confirmations (e.g., `noreply@contoso.com`) | Must be a valid Exchange Online mailbox in the tenant |
| `TEAMS_APP_ID` | Teams app ID for deep link construction in activity feed notifications | `spfx/teams/manifest.json` > `id` field |
| `APP_BASE_URL` | SharePoint site URL where the web part is deployed (e.g., `https://contoso.sharepoint.com/sites/rentavehicle`) | SharePoint site URL |

### Local Development Only

| Name | Description | Where to Find |
|---|---|---|
| `LOCAL_DEV` | Set to `true` to enable local dev authentication bypass | Static value |
| `LOCAL_DEV_NAME` | Display name for the simulated local dev user | Your choice |
| `LOCAL_DEV_EMAIL` | Email for the simulated local dev user | Must be a real tenant user email for Graph API calls |
| `LOCAL_DEV_ROLE` | Role for local dev user: `Employee`, `Manager`, `Admin`, or `SuperAdmin` | Your choice (default: `Employee`) |
| `LOCAL_DEV_OFFICE_LOCATION` | Office location for local dev user | Must match a location name in the Locations table |

> [!TIP]
> For local development, you can manage tenant-specific secrets in `../.rentavehicle/secrets.json` (outside the repo). The `scripts/sync-dev-config.js` script merges these into `api/local.settings.json` on each build. See the [Deployment Guide](deployment.md) for details.

## Verification

After completing all steps, confirm the following:

1. **Admin consent granted:** All four API permissions (Calendars.ReadWrite, Mail.Send, User.Read.All, TeamsActivity.Send) show green checkmarks in the API permissions blade.
2. **Application ID URI set:** The "Expose an API" blade shows `api://<your-client-id>` with the `user_impersonation` scope.
3. **SharePoint pre-authorized:** The authorized client applications list includes `00000003-0000-0ff1-ce00-000000000000`.
4. **Client secret created:** You have recorded the secret value (it cannot be retrieved after leaving the page).
5. **App roles created:** The "App roles" blade shows Admin, Manager, and Employee roles.
6. **Easy Auth configured:** The Azure Functions Authentication blade shows Microsoft as the identity provider with the correct client ID.

---

*RentAVehicle -- Microsoft Entra ID App Registration Guide*
