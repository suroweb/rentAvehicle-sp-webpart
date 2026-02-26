# Deployment Guide

This guide covers end-to-end deployment of the RentAVehicle application: building the SPFx package, deploying to the SharePoint App Catalog, setting up Azure Functions with a SQL database, provisioning vehicle resource mailboxes, and configuring the Teams tab with activity feed notifications.

## Prerequisites

- Completed [Entra ID app registration](app-registration.md) with all permissions granted and client secret created
- SharePoint App Catalog administrator access
- Azure subscription with permissions to create Function Apps and SQL databases
- Node.js 22 (the project enforces `>=22.14.0 < 23.0.0` in `spfx/package.json`)
- npm (included with Node.js)

## Part 1: Build the SPFx Package

1. Clone the repository and navigate to the SPFx project:
   ```bash
   git clone <repository-url>
   cd Rentavehicle/spfx
   npm install
   ```

2. Configure the Entra ID client ID for the web part. Create or update the secrets file at `../.rentavehicle/secrets.json` (one directory above the repo root):
   ```json
   {
     "AZURE_CLIENT_ID": "<your-client-id-from-app-registration>"
   }
   ```
   The `prebuild` hook runs `tools/generate-env.js`, which reads this file and generates `src/config/env.generated.ts` with the client ID baked into the SPFx bundle.

3. Build the production package:
   ```bash
   npm run build
   ```
   This runs the Heft build pipeline: `heft test --clean --production && heft package-solution --production`.

4. The output package is located at:
   ```
   spfx/sharepoint/solution/renta-vehicle.sppkg
   ```

> [!TIP]
> For local development, use `npm start` instead. This runs `heft start --clean` which serves the web part locally on `https://localhost:4321` for use with the SharePoint workbench.

## Part 2: Deploy to SharePoint App Catalog

1. Sign in to the [SharePoint Admin Center](https://admin.microsoft.com/sharepoint).
2. Navigate to **More features** > **Apps** > **App Catalog**. If no App Catalog exists, create one.
3. Click **Apps for SharePoint** in the left navigation.
4. Click **Upload** and select `renta-vehicle.sppkg`.
5. In the trust dialog:
   - Check **Make this solution available to all sites in the organization** (the package has `skipFeatureDeployment: true`).
   - The dialog will show that the solution requests permission to access `RentAVehicle-API` with the `user_impersonation` scope.
6. Click **Deploy**.

> [!NOTE]
> The `package-solution.json` declares a `webApiPermissionRequests` entry for `RentAVehicle-API` / `user_impersonation`. This request must be approved in the SharePoint Admin Center before the web part can call the backend API. See Part 3.

## Part 3: Approve API Permissions

1. In the SharePoint Admin Center, navigate to **Advanced** > **API access**.
2. You should see a pending request for:
   - **Package:** `renta-vehicle-client-side-solution`
   - **Resource:** `RentAVehicle-API`
   - **Scope:** `user_impersonation`
3. Select the pending request and click **Approve**.

> [!WARNING]
> If the request does not appear, verify that the app registration has the "Expose an API" section configured with the `user_impersonation` scope and that the SharePoint Client Extensibility Principal (`00000003-0000-0ff1-ce00-000000000000`) is pre-authorized. See [Step 3 in the App Registration Guide](app-registration.md#step-3-expose-an-api).

## Part 4: Deploy Azure Functions

### 4.1 Build the API

1. Navigate to the API project:
   ```bash
   cd Rentavehicle/api
   npm install
   ```

2. Build the TypeScript source:
   ```bash
   npm run build
   ```
   This runs `tsc` and outputs to the `dist/` directory.

3. For local development, use:
   ```bash
   npm start
   ```
   This runs `prestart` (which calls `scripts/sync-dev-config.js` to merge secrets then compiles) followed by `func start` to launch the Azure Functions runtime locally.

### 4.2 Configure Environment Variables

Set the following environment variables in your Azure Function App's **Application Settings** (or in `api/local.settings.json` for local development). See the [App Registration Guide](app-registration.md#step-7-environment-variables) for the full table with descriptions.

Required for production:

| Variable | Value |
|---|---|
| `FUNCTIONS_WORKER_RUNTIME` | `node` |
| `AZURE_TENANT_ID` | `<your-tenant-id>` |
| `AZURE_CLIENT_ID` | `<your-client-id>` |
| `AZURE_CLIENT_SECRET` | `<your-client-secret>` (or use Managed Identity) |
| `AZURE_SQL_SERVER` | `<your-sql-server>.database.windows.net` |
| `AZURE_SQL_DATABASE` | `RentAVehicle` |
| `AZURE_SQL_PORT` | `1433` |
| `AZURE_SQL_USER` | `<your-sql-admin-user>` |
| `AZURE_SQL_PASSWORD` | `<your-sql-admin-password>` |
| `NOTIFICATION_SENDER_EMAIL` | `<licensed-mailbox@yourtenant.com>` |
| `TEAMS_APP_ID` | `<teams-app-id>` (same as `id` in `spfx/teams/manifest.json`) |
| `APP_BASE_URL` | `https://<tenant>.sharepoint.com/sites/<site>` |

### 4.3 Configure CORS

In the Azure Portal, navigate to your Function App > **API** > **CORS** and add the following allowed origins:

- `https://<your-tenant>.sharepoint.com` -- your tenant's SharePoint domain

For local development, the `local.settings.template.json` includes these CORS origins in the `Host.CORS` section:
```
https://localhost:4321
http://localhost:4321
https://contoso.sharepoint.com
```

Replace `contoso.sharepoint.com` with your tenant's SharePoint domain.

### 4.4 Set Up the Database

The project includes a setup script that creates the database schema and seeds test data.

1. Ensure SQL Server is running and accessible (locally via Docker, or Azure SQL).
2. Run the setup script:
   ```bash
   node setup-db.js
   ```

This script:
- Creates the `RentAVehicle` database if it does not exist
- Creates the `Locations`, `Categories`, `Vehicles`, and `Bookings` tables
- Adds indexes for performance (vehicle status, booking lookup, user bookings)
- Adds columns for calendar integration (`resourceMailboxEmail`, `vehicleCalendarEventId`, `employeeCalendarEventId`)
- Seeds test data: two locations (Bucharest, Cluj), two categories (Sedan, SUV), and three vehicles

> [!NOTE]
> The script is idempotent -- running it multiple times will not create duplicate tables or data. Existing objects are detected and skipped.

### 4.5 Deploy to Azure

For Azure deployment, use the Azure Functions Core Tools or the Azure Portal:

```bash
# Using Azure Functions Core Tools
cd api
func azure functionapp publish <your-function-app-name>
```

Or deploy via the Azure Portal by connecting to your Git repository for continuous deployment.

## Part 5: Vehicle Resource Mailboxes

Each vehicle in the fleet can have an Exchange Online equipment mailbox for calendar-based availability tracking. When a booking is created, the API creates calendar events on both the vehicle's resource calendar and the employee's personal calendar.

### Automated Provisioning

The project includes a PowerShell script that automates mailbox creation:

```powershell
# Prerequisites
Install-Module ExchangeOnlineManagement -Force
Connect-ExchangeOnline -UserPrincipalName admin@yourtenant.onmicrosoft.com

# Provision a vehicle mailbox
.\scripts\provision-vehicle-mailbox.ps1 `
    -Make "Toyota" -Model "Camry" -LicensePlate "ABC1234" `
    -LocationName "Seattle Office" `
    -AppServiceAccount "rentavehicle-app@contoso.com"
```

The script performs four steps:
1. Creates an equipment mailbox with alias `car-{make}-{model}-{plate}`
2. Configures calendar processing: auto-accept bookings only from the app service account, reject all others, disallow conflicts
3. Grants all organization users Reviewer access to the vehicle calendar
4. Optionally adds the mailbox to a room list distribution group for location-based grouping

> [!TIP]
> After provisioning, the script outputs the generated email address. Register it with the vehicle in RentAVehicle using the API: `PATCH /api/backoffice/vehicles/{id}/mailbox` with body `{ "resourceMailboxEmail": "<generated-email>" }`.

### Manual Provisioning

If you prefer to create mailboxes manually:

1. Open Exchange Online PowerShell.
2. Create the equipment mailbox:
   ```powershell
   New-Mailbox -Equipment -Name "Toyota Camry (ABC1234) - Seattle Office" -Alias "car-toyota-camry-abc1234"
   ```
3. Configure calendar processing:
   ```powershell
   Set-CalendarProcessing -Identity "car-toyota-camry-abc1234" `
       -AutomateProcessing AutoAccept `
       -AllBookInPolicy $false `
       -BookInPolicy "rentavehicle-app@contoso.com" `
       -AllowConflicts $false
   ```
4. Grant Reviewer access:
   ```powershell
   Set-MailboxFolderPermission -Identity "car-toyota-camry-abc1234:\Calendar" -User Default -AccessRights Reviewer
   ```

## Part 6: Add to a SharePoint Site

Once the package is deployed and API permissions are approved:

1. Navigate to the target SharePoint site.
2. Edit a page (or create a new page).
3. Click the **+** button to add a web part.
4. Search for **RentAVehicle** and add it to the page.
5. Publish the page.

Alternatively, add from **Site contents** > **New** > **App** > search for **RentAVehicle**.

> [!NOTE]
> Because `skipFeatureDeployment` is `true`, the web part is available on all sites without activating a site-level feature. No additional activation is required.

## Part 7: Deploy as Teams Tab

The RentAVehicle web part can run as a personal tab in Microsoft Teams. This enables Teams activity feed notifications for booking confirmations, pickup reminders, return reminders, and overdue alerts.

> [!WARNING]
> Do NOT use "Sync to Teams" from the SharePoint App Catalog if you need Teams activity feed notifications. The auto-generated manifest strips the `webApplicationInfo` and `activities` sections, which causes Graph API `sendActivityNotification` calls to return 403 Forbidden.

### Deploy with Custom Manifest

The SPFx project includes a custom Teams manifest at `spfx/teams/manifest.json` that declares the required `webApplicationInfo` and activity types.

1. **Verify the manifest configuration:**

   The `webApplicationInfo` section in `spfx/teams/manifest.json` must have its `id` field set to the **backend Entra app registration client ID** (the same `AZURE_CLIENT_ID` used by Azure Functions):

   ```json
   "webApplicationInfo": {
     "id": "<your-backend-client-id>",
     "resource": "api://<your-backend-client-id>"
   }
   ```

   > [!WARNING]
   > The `webApplicationInfo.id` MUST match the backend Entra app registration client ID, NOT the SharePoint Client Extensibility Web Application Principal. This is because Azure Functions calls Graph API `sendActivityNotification` using the app registration's identity, and Graph validates that the calling app ID matches the `webApplicationInfo.id` in the installed Teams app manifest.

2. **Activity types declared in the manifest:**

   | Type | Description | Template |
   |---|---|---|
   | `bookingConfirmed` | A vehicle booking has been confirmed | `{actor} confirmed booking for {vehicle}` |
   | `managerBookingAlert` | An employee created a new vehicle booking | `{actor} booked {vehicle}` |
   | `pickupReminder` | Reminder to pick up a booked vehicle | `Pickup reminder for {vehicle}` |
   | `returnReminder` | Reminder to return a booked vehicle | `Return reminder for {vehicle}` |
   | `bookingOverdue` | A vehicle booking is overdue for return | `{vehicle} return is overdue` |
   | `bookingCancelled` | A vehicle booking has been cancelled | `Booking for {vehicle} was cancelled` |

   Additionally, the manifest declares the RSC (Resource-Specific Consent) permission `TeamsActivity.Send.User` under `authorization.permissions.resourceSpecific`.

3. **Package and upload:**

   Option A -- Upload via Teams Admin Center:
   - Create a ZIP file named `TeamsSPFxApp.zip` containing `manifest.json` and the icon files from `spfx/teams/`
   - Open the [Teams Admin Center](https://admin.teams.microsoft.com) > **Teams apps** > **Manage apps** > **Upload new app**
   - Upload the ZIP file

   Option B -- Place in SPFx project and rebuild:
   - Place `TeamsSPFxApp.zip` in the `spfx/teams/` folder
   - Rebuild the SPFx package (`npm run build`)
   - Upload the new `.sppkg` to the App Catalog
   - Use "Sync to Teams" -- with `TeamsSPFxApp.zip` present, the sync uses the custom package

4. **Install for users:**
   - In the Teams Admin Center, assign the app to users via **Setup policies** or allow users to install it from the Teams app store.

### Version Management

When deploying updates:

- **SPFx package version:** Update the `version` field in `spfx/config/package-solution.json` (currently `1.2.0.0`)
- **Teams manifest version:** Update the `version` field in `spfx/teams/manifest.json` (currently `1.2.0`)
- Both versions must increment for Teams to detect the update. The Teams app ID (`faa3486e-fc56-40d2-b420-c5b9d30257b3`) remains the same across versions.

> [!NOTE]
> The Teams manifest `id` field (`faa3486e-fc56-40d2-b420-c5b9d30257b3`) matches the SPFx solution `id` in `package-solution.json`. This links the Teams app to the SPFx package.

## Troubleshooting

### "An OAuth permission with the scope user_impersonation could not be found"

**Cause:** The app registration's "Expose an API" section is not configured, or the `user_impersonation` scope was not created.

**Fix:** Follow [Step 3 in the App Registration Guide](app-registration.md#step-3-expose-an-api). Ensure the Application ID URI is set to `api://<client-id>` and the `user_impersonation` scope exists and is enabled.

---

### "403 Forbidden on Graph API calls" (Calendar, Email, or User endpoints)

**Cause:** API permissions were not granted admin consent, or delegated permissions were added instead of application permissions.

**Fix:**
1. In the app registration, go to **API permissions**.
2. Verify all four permissions are listed as **Application** type (not Delegated).
3. Click **Grant admin consent for [tenant]** and confirm all show green checkmarks.

---

### "Teams notifications return 403: Application is not authorized to generate custom text notifications"

**Cause:** The Teams app was deployed using "Sync to Teams" from the App Catalog, which auto-generates a manifest that strips the `webApplicationInfo` and `activities` sections. Without `webApplicationInfo.id` matching the calling Entra app, Graph cannot authorize the notification.

**Fix:**
1. Remove the auto-synced app from the Teams Admin Center.
2. Deploy using the custom manifest approach described in Part 7 above.
3. Ensure `webApplicationInfo.id` in the manifest matches the `AZURE_CLIENT_ID` used by Azure Functions.

---

### "SPFx web part not appearing in the web part gallery"

**Cause:** The package was not trusted during upload, or the site-level feature was not activated.

**Fix:**
1. In the App Catalog, verify the package shows "Deployed" status with a green indicator.
2. If the package was uploaded without checking "Make this solution available to all sites", navigate to the target site's **Site contents** > **New** > **App** and add RentAVehicle.
3. Try editing a page and adding the web part. If it still does not appear, retract and redeploy the package.

---

### "AadHttpClient returns 401 Unauthorized"

**Cause:** Client ID mismatch between the SPFx `webApiPermissionRequests` resource name and the Entra app registration display name, or the API permission was not approved.

**Fix:**
1. Verify the `resource` field in `spfx/config/package-solution.json` matches the Entra app registration name exactly: `RentAVehicle-API`.
2. In the SharePoint Admin Center > **API access**, confirm the permission for `RentAVehicle-API` / `user_impersonation` is approved.
3. If you renamed the app registration after deploying the SPFx package, retract and redeploy the package.

---

### "Database connection fails" or "Cannot open server"

**Cause:** SQL Server is not running, network rules are blocking the connection, or credentials are incorrect.

**Fix:**
1. Verify `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USER`, and `AZURE_SQL_PASSWORD` are set correctly.
2. For Azure SQL, add your client IP to the server's firewall rules in the Azure Portal.
3. For local development, ensure the SQL Server Docker container is running on port 1433.

---

### "Teams manifest upload rejected: App with same App-ID already exists"

**Cause:** A previous version of the app (often from "Sync to Teams") is still registered with the same app ID.

**Fix:**
1. In the Teams Admin Center, search for apps with the name "RentAVehicle" or the ID `faa3486e-fc56-40d2-b420-c5b9d30257b3`.
2. Delete the existing app.
3. Wait 5-10 minutes for Teams cache propagation.
4. Upload the new manifest.

---

*RentAVehicle -- Deployment Guide*
