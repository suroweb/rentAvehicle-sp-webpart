# Architecture Research

**Domain:** Internal vehicle rental system on M365/Azure
**Researched:** 2026-02-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
                         Microsoft 365 Tenant
 ┌────────────────────────────────────────────────────────────────────┐
 │                                                                    │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │                  SPFx Webpart (React)                        │  │
 │  │     SharePoint Online page  /  Microsoft Teams tab           │  │
 │  │                                                              │  │
 │  │  AadHttpClient ──── bearer token (OAuth 2.0 implicit) ──┐   │  │
 │  └──────────────────────────────────────────────────────────┼───┘  │
 │                                                             │      │
 │  ┌──────────────────────────────────────────────────────────┼───┐  │
 │  │              Microsoft Entra ID                          │   │  │
 │  │                                                          │   │  │
 │  │  SharePoint Online Client Extensibility principal        │   │  │
 │  │  ──obtains token for API app registration──────────────► │   │  │
 │  │                                                          │   │  │
 │  │  API app registration (Azure Functions)                  │   │  │
 │  │  ──OBO flow──exchanges token for Graph API token──────►  │   │  │
 │  │                                                          │   │  │
 │  │  Managed Identity (Azure Functions → Azure SQL)          │   │  │
 │  └──────────────────────────────────────────────────────────┼───┘  │
 │                                                             │      │
 └─────────────────────────────────────────────────────────────┼──────┘
                                                               │
                              Azure                            │
 ┌─────────────────────────────────────────────────────────────┼──────┐
 │                                                             ▼      │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │              Azure Functions (HTTP-triggered)                 │  │
 │  │                                                              │  │
 │  │  Validates bearer token (Entra ID authentication)            │  │
 │  │  Extracts user identity from token claims                    │  │
 │  │  Enforces role-based access (Employee/Manager/Admin)         │  │
 │  │                                                              │  │
 │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
 │  │  │ Vehicles │  │ Bookings │  │ Locations│  │ Admin/      │  │  │
 │  │  │ API      │  │ API      │  │ API      │  │ Reporting   │  │  │
 │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │  │
 │  └───────┼──────────────┼──────────────┼──────────────┼─────────┘  │
 │          │              │              │              │             │
 │          ▼              ▼              ▼              ▼             │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │              Azure SQL Database                              │  │
 │  │  (Managed Identity connection, no secrets)                   │  │
 │  │                                                              │  │
 │  │  Vehicles, Bookings, Locations, AuditLog                     │  │
 │  └──────────────────────────────────────────────────────────────┘  │
 │                                                                    │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │  Azure Functions ──OBO token──► Microsoft Graph API          │  │
 │  │                                                              │  │
 │  │  Graph API calls:                                            │  │
 │  │  ├── Create/read calendar events on equipment mailboxes      │  │
 │  │  ├── Send email notifications (Mail.Send)                    │  │
 │  │  ├── Post Teams chat messages (Chat.ReadWrite)               │  │
 │  │  └── Read user/location data from Entra ID (User.Read.All)  │  │
 │  └──────────────────────────────────────────────────────────────┘  │
 │                                                                    │
 └────────────────────────────────────────────────────────────────────┘

                         Exchange Online
 ┌────────────────────────────────────────────────────────────────────┐
 │  Equipment Mailboxes (one per vehicle)                             │
 │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
 │  │ Vehicle1 │  │ Vehicle2 │  │ Vehicle3 │  │ VehicleN │          │
 │  │ Calendar │  │ Calendar │  │ Calendar │  │ Calendar │          │
 │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
 │  Managed via Exchange Online PowerShell + Graph API               │
 └────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **SPFx Webpart** | UI rendering, user interaction, client-side routing between views (browse, book, history, admin). Authenticates to API via AadHttpClient. | React components, Fluent UI, `@microsoft/sp-http` AadHttpClient |
| **Microsoft Entra ID** | Identity provider, SSO, token issuance, app registrations, role/group assignments for RBAC | App registrations for Azure Functions API; app roles for Employee/Manager/Admin; admin consent for Graph permissions |
| **Azure Functions API** | Business logic, authorization enforcement, data access, Graph API orchestration. Stateless HTTP-triggered functions. | .NET 8 isolated process (C#), organized by domain (Vehicles, Bookings, Locations, Admin) |
| **Azure SQL Database** | Persistent relational storage for vehicles, bookings, locations cache, audit log | Azure SQL with managed identity auth, Entity Framework Core |
| **Microsoft Graph API** | Calendar events on vehicle equipment mailboxes, email/Teams notifications, user profile and location data from Entra ID | Delegated permissions via OBO flow for user-context operations; application permissions for background tasks like reminders |
| **Exchange Online Equipment Mailboxes** | One mailbox per vehicle, provides native Outlook calendar visibility of vehicle bookings | Created via Exchange Online PowerShell (`New-Mailbox -Equipment`), booking policies via `Set-CalendarProcessing` |

## Recommended Project Structure

```
rentavehicle/
├── spfx/                              # SPFx solution (frontend)
│   ├── src/
│   │   └── webparts/
│   │       └── rentaVehicle/
│   │           ├── components/        # React components
│   │           │   ├── VehicleBrowser/ # Browse/filter vehicles
│   │           │   ├── BookingForm/    # Create booking
│   │           │   ├── BookingCalendar/# Calendar view of availability
│   │           │   ├── MyRentals/      # Employee rental history
│   │           │   ├── TeamRentals/    # Manager team view
│   │           │   └── AdminPanel/     # Admin CRUD, reporting
│   │           ├── services/          # API client wrappers
│   │           │   └── ApiService.ts  # AadHttpClient calls to Azure Functions
│   │           ├── models/            # TypeScript interfaces
│   │           └── RentaVehicleWebPart.ts
│   ├── config/
│   │   └── package-solution.json      # webApiPermissionRequests
│   └── sharepoint/
│       └── solution/                  # .sppkg output
│
├── api/                               # Azure Functions (backend)
│   ├── Functions/
│   │   ├── Vehicles/                  # GET list, GET by id, POST, PUT, DELETE
│   │   ├── Bookings/                  # POST create, PUT check-in, GET history, DELETE cancel
│   │   ├── Locations/                 # GET locations (synced from Entra)
│   │   ├── Admin/                     # GET reports, GET all bookings, PUT override
│   │   └── Notifications/            # Timer-triggered return reminders
│   ├── Services/
│   │   ├── GraphService.cs            # Graph API client (OBO + app permissions)
│   │   ├── CalendarService.cs         # Equipment mailbox calendar operations
│   │   └── NotificationService.cs     # Email and Teams message sending
│   ├── Data/
│   │   ├── RentaVehicleDbContext.cs    # EF Core DbContext
│   │   ├── Entities/                  # Vehicle, Booking, Location, AuditLog
│   │   └── Migrations/               # EF Core migrations
│   ├── Auth/
│   │   └── RoleAuthorizationMiddleware.cs  # Role checks from token claims
│   └── host.json
│
├── infra/                             # Infrastructure as Code
│   ├── main.bicep                     # Azure SQL, Function App, App Registration
│   └── modules/
│
├── scripts/                           # Setup scripts
│   ├── Create-EquipmentMailboxes.ps1  # Exchange Online PowerShell
│   └── Seed-Database.ps1             # Initial data
│
└── .planning/                         # Project planning docs
```

### Structure Rationale

- **spfx/ and api/ as sibling folders:** Clean separation between frontend (SPFx) and backend (Azure Functions). Each has its own build toolchain (Heft/webpack for SPFx, dotnet for Functions). They share only contract interfaces (API request/response shapes).
- **api/Functions/ grouped by domain:** Each domain (Vehicles, Bookings, Locations, Admin) has its own folder of HTTP-triggered functions. This maps cleanly to API routes and keeps function code cohesive.
- **api/Services/ for cross-cutting concerns:** Graph API calls, calendar operations, and notifications are extracted into injectable services, not inlined in function handlers. This enables unit testing and reuse.
- **infra/ for Bicep templates:** Azure SQL, Function App, and Entra app registration provisioning should be codified. Equipment mailbox creation remains a PowerShell script because Exchange Online resources are not Bicep-manageable.
- **scripts/ for Exchange setup:** Equipment mailboxes must be created via Exchange Online PowerShell. This is a one-time setup per vehicle, scripted for repeatability.

## Architectural Patterns

### Pattern 1: SPFx AadHttpClient for Authenticated API Calls

**What:** SPFx uses the built-in `AadHttpClient` class to obtain bearer tokens for the Azure Functions API. The token is issued by the **SharePoint Online Client Extensibility** service principal in Entra ID. The SPFx solution declares required permissions in `package-solution.json` under `webApiPermissionRequests`. A SharePoint admin approves these permissions once. After approval, every instance of the webpart can silently acquire tokens for the API.

**When to use:** Always, for SPFx-to-custom-API communication. This is the officially supported approach (Microsoft Learn, updated October 2025).

**Trade-offs:**
- Pro: No MSAL.js needed in SPFx; framework handles token acquisition and caching
- Pro: Permissions managed centrally via SharePoint admin center
- Con: Permissions are tenant-wide once granted (any SPFx solution in the tenant could theoretically request the same scope)
- Con: Requires SharePoint admin consent during deployment

**Example:**
```typescript
// In SPFx webpart
import { AadHttpClient, HttpClientResponse } from '@microsoft/sp-http';

// In onInit():
const client: AadHttpClient = await this.context.aadHttpClientFactory
  .getClient('api://<azure-functions-app-id>');

// In API calls:
const response: HttpClientResponse = await client
  .get('https://<functionapp>.azurewebsites.net/api/vehicles?locationId=1',
    AadHttpClient.configurations.v1);
const vehicles = await response.json();
```

```json
// config/package-solution.json
{
  "solution": {
    "webApiPermissionRequests": [
      {
        "resource": "RentAVehicle-API",
        "scope": "user_impersonation"
      }
    ]
  }
}
```

### Pattern 2: On-Behalf-Of (OBO) Flow for Graph API from Azure Functions

**What:** When Azure Functions receives a request from SPFx, the bearer token in the Authorization header represents the signed-in user. To call Graph API on behalf of that user (e.g., create a calendar event in their name), the function uses MSAL's `AcquireTokenOnBehalfOf` to exchange the incoming user token for a new token scoped to Microsoft Graph. This preserves user context: the Graph call happens as the user, respecting their permissions.

**When to use:** For user-context operations: creating booking events on vehicle calendars, reading user profiles, sending notifications from the user's context.

**Trade-offs:**
- Pro: Respects user permissions and audit trails
- Pro: No need for broad application-level permissions for user-initiated actions
- Con: Requires a client secret or certificate for the API app registration
- Con: Token exchange adds latency (~100-200ms)
- Con: Requires delegated Graph permissions (Calendars.ReadWrite, Mail.Send, etc.) on the API app registration

**Example:**
```csharp
// In Azure Function
var confidentialClient = ConfidentialClientApplicationBuilder
    .Create(config.ClientId)
    .WithClientSecret(config.ClientSecret)
    .WithAuthority($"https://login.microsoftonline.com/{config.TenantId}")
    .Build();

var userAssertion = new UserAssertion(incomingAccessToken);
var result = await confidentialClient
    .AcquireTokenOnBehalfOf(
        new[] { "https://graph.microsoft.com/Calendars.ReadWrite" },
        userAssertion)
    .ExecuteAsync();

var graphClient = new GraphServiceClient(
    new DelegateAuthenticationProvider(req => {
        req.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", result.AccessToken);
        return Task.CompletedTask;
    }));
```

### Pattern 3: Application Permissions for Background/Timer Operations

**What:** For operations that run without user context (e.g., timer-triggered return reminder emails, location sync from Entra ID), the Azure Function authenticates to Graph API using application permissions via the function app's managed identity or client credentials flow. No user token is involved.

**When to use:** Timer-triggered functions: return reminders, utilization report generation, location data sync from Entra ID directory.

**Trade-offs:**
- Pro: Runs unattended, no user session required
- Pro: Managed identity eliminates secrets management for Azure SQL; client credentials for Graph
- Con: Application permissions are broader (e.g., `Calendars.ReadWrite` on all mailboxes) -- requires admin consent and careful scoping
- Con: Actions are not attributable to a specific user in Graph audit logs

### Pattern 4: Equipment Mailboxes as Vehicle Resource Calendars

**What:** Each vehicle in the fleet gets an Exchange Online **equipment mailbox** (not a room mailbox, because vehicles are not location-bound resources). The equipment mailbox has a calendar. When a booking is created, the Azure Function creates a calendar event on the equipment mailbox via Graph API, making the booking visible in Outlook to anyone with access. The mailbox's `CalendarProcessing` policy controls auto-accept behavior.

**When to use:** For every vehicle in the fleet. Created once per vehicle via Exchange Online PowerShell.

**Trade-offs:**
- Pro: Native Outlook visibility -- users can see vehicle bookings in their calendar and the vehicle's calendar
- Pro: Exchange handles conflict detection if auto-accept is enabled
- Con: Equipment mailboxes require Exchange Online licenses (or at minimum, a resource mailbox license)
- Con: Graph API cannot create webhook subscriptions on resource mailboxes (must poll for changes)
- Con: Equipment mailbox creation is PowerShell-only, not automatable via Graph API

**Example (PowerShell setup):**
```powershell
# Create equipment mailbox for a vehicle
New-Mailbox -Name "Vehicle-Toyota-Corolla-ABC123" `
  -Equipment `
  -DisplayName "Toyota Corolla (ABC-123)" `
  -PrimarySmtpAddress vehicle-abc123@contoso.com

# Configure auto-accept for bookings
Set-CalendarProcessing -Identity "Vehicle-Toyota-Corolla-ABC123" `
  -AutomateProcessing AutoAccept `
  -AllBookInPolicy $true `
  -BookingWindowInDays 90 `
  -MaximumDurationInMinutes 14400  # 10 days max
```

## Data Flow

### Booking a Vehicle (Primary Flow)

```
Employee opens SPFx webpart in SharePoint/Teams
    │
    ▼
SPFx calls AadHttpClient.getClient('api://rentavehicle-api')
    │ (framework obtains bearer token from Entra ID via
    │  SharePoint Online Client Extensibility principal)
    ▼
SPFx sends GET /api/vehicles?locationId=X&from=...&to=...
    │ Authorization: Bearer <user-token-for-api>
    ▼
Azure Function validates token (Entra ID authentication middleware)
    │ Extracts user identity, roles from token claims
    ▼
Azure Function queries Azure SQL
    │ (managed identity connection, no connection string secrets)
    │ SELECT vehicles WHERE location = X
    │   AND id NOT IN (SELECT vehicleId FROM bookings
    │                   WHERE daterange overlaps requested range)
    ▼
Returns available vehicles to SPFx → employee selects one
    │
    ▼
SPFx sends POST /api/bookings
    │ { vehicleId, startDateTime, endDateTime } (UTC)
    │ Authorization: Bearer <user-token-for-api>
    ▼
Azure Function validates + creates booking in Azure SQL
    │
    ├──► OBO token exchange → Graph API: Create calendar event
    │    on equipment mailbox (vehicle-abc123@contoso.com)
    │    with employee as organizer, vehicle as attendee
    │
    ├──► OBO token exchange → Graph API: Send confirmation email
    │    to employee via Mail.Send
    │
    ├──► OBO token exchange → Graph API: Post Teams notification
    │    to employee (and optionally manager)
    │
    ▼
Returns booking confirmation to SPFx → UI updates
```

### Return Reminder (Background Flow)

```
Timer-triggered Azure Function (runs every hour)
    │
    ▼
Queries Azure SQL: SELECT bookings WHERE
    │ returnDateTime BETWEEN now AND now + 2 hours
    │ AND reminderSent = false
    ▼
For each upcoming return:
    │
    ├──► Client credentials → Graph API: Send reminder email
    │    to employee (application permission: Mail.Send)
    │
    ├──► Update Azure SQL: SET reminderSent = true
    │
    ▼
Done (no user context needed)
```

### Location Sync (Background Flow)

```
Timer-triggered Azure Function (runs daily)
    │
    ▼
Client credentials → Graph API: GET /organization
    │ or GET /places (if using Microsoft Places)
    │ Read office locations from Entra ID directory
    ▼
Upsert locations into Azure SQL
    │ (id, name, address, timezone, country)
    ▼
Done
```

### Key Data Flows Summary

1. **SPFx to API:** AadHttpClient obtains bearer token, sends HTTPS request to Azure Functions. Token validated by Entra ID authentication middleware on the Function App.
2. **API to Azure SQL:** Managed identity connection (no passwords). EF Core for queries and mutations.
3. **API to Graph (user context):** OBO flow exchanges user token for Graph-scoped token. Used for booking calendar events, confirmation emails, Teams messages.
4. **API to Graph (app context):** Client credentials or managed identity. Used for timer-triggered reminders, location sync, admin reporting on all calendars.
5. **Graph to Exchange:** Calendar events created via Graph API appear on equipment mailbox calendars. Equipment mailbox auto-accepts if `CalendarProcessing` is configured.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (typical) | Current architecture as-is. Azure Functions Consumption plan, Azure SQL Basic/S0 tier. Single Function App handles all endpoints. Equipment mailboxes scale linearly with fleet size (typically 10-200 vehicles). |
| 500-5k users | Azure SQL S1-S2 tier. Add Azure SQL read replica if reporting queries compete with transactional workload. Consider Azure Functions Premium plan for consistent cold-start avoidance. Add Application Insights for monitoring. |
| 5k+ users | Azure SQL elastic pool if multi-region. Azure Front Door for global distribution. Consider splitting Notifications into separate Function App with queue-triggered functions (Azure Service Bus) to decouple booking creation from notification delivery. |

### Scaling Priorities

1. **First bottleneck: Azure SQL concurrent connections.** The Consumption plan can spike many function instances, each opening DB connections. Use connection pooling (EF Core with `MaxPoolSize`) and consider Azure SQL S1+ for connection limits.
2. **Second bottleneck: Graph API throttling.** Microsoft Graph enforces rate limits per tenant. Batch calendar event creation where possible. Implement retry with exponential backoff using the `Retry-After` header. For reminders, use a queue to spread Graph calls over time.

## Anti-Patterns

### Anti-Pattern 1: Calling Graph API Directly from SPFx

**What people do:** Use MSGraphClient in SPFx to read/write calendar events and send notifications directly from the browser, bypassing Azure Functions entirely.
**Why it's wrong:** Business logic (conflict detection, booking validation, role enforcement) would live in the client. No server-side validation means any user with F12 dev tools could bypass rules. Also, Graph permissions granted to the SharePoint Online Client Extensibility principal apply to the entire tenant, not just your solution.
**Do this instead:** All Graph API calls flow through Azure Functions. The API enforces business rules, then makes Graph calls server-side via OBO or app permissions.

### Anti-Pattern 2: Storing Secrets in SPFx or App Settings

**What people do:** Hard-code client secrets, connection strings, or API keys in SPFx code, Azure Function app settings, or source control.
**Why it's wrong:** SPFx code is fully client-side and visible to anyone. App settings, while server-side, are still secrets that can leak. Connection strings with passwords are a maintenance burden.
**Do this instead:** Use managed identity for Azure Functions to Azure SQL (zero secrets). Use Azure Key Vault for the API app registration's client secret (needed for OBO flow). Reference Key Vault secrets from Function App configuration.

### Anti-Pattern 3: Using SharePoint Lists Instead of Azure SQL

**What people do:** Store vehicles and bookings in SharePoint lists to avoid provisioning Azure SQL.
**Why it's wrong:** SharePoint list views have a 5,000-item threshold. Complex joins (vehicles + bookings + locations) are not possible. Reporting queries (utilization rates, trends) are extremely limited. Concurrent writes cause conflicts.
**Do this instead:** Use Azure SQL. The cost is minimal (Basic tier: ~$5/month). It provides proper relational queries, concurrent access, and scales for reporting.

### Anti-Pattern 4: Creating Equipment Mailboxes via Graph API

**What people do:** Attempt to automate equipment mailbox creation through Graph API.
**Why it's wrong:** Graph API does not support creating resource (room/equipment) mailboxes. This is an Exchange Online PowerShell-only operation. Attempting to use Graph will fail.
**Do this instead:** Script mailbox creation with Exchange Online PowerShell (`New-Mailbox -Equipment`). Store the mailbox email address in Azure SQL as a property of the Vehicle entity. The API uses this email address when making Graph calendar calls.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Microsoft Graph API** | OBO flow (user context) + client credentials (app context) via MSAL and `GraphServiceClient` | Delegated: Calendars.ReadWrite, Mail.Send, User.Read.All, Chat.ReadWrite. Application: Calendars.ReadWrite, Mail.Send, User.Read.All |
| **Exchange Online** | Equipment mailboxes created via PowerShell; calendar read/write via Graph API | Cannot use webhook subscriptions on resource mailboxes; poll or treat Azure SQL as source of truth |
| **Azure SQL Database** | Managed identity connection from Azure Functions; EF Core ORM | Connection string: `Server=<server>.database.windows.net;Database=RentAVehicle;Authentication=Active Directory Managed Identity` |
| **Azure Key Vault** | Function App references Key Vault for client secret (OBO flow) | `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>)` in app settings |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **SPFx Webpart <-> Azure Functions** | HTTPS + bearer token (AadHttpClient) | CORS must allow SharePoint domain; token audience = API app registration |
| **Azure Functions <-> Azure SQL** | TCP (managed identity, EF Core) | No secrets; identity-based connection |
| **Azure Functions <-> Graph API** | HTTPS + OBO token or client credentials token | OBO for user-initiated; app permissions for timer-triggered |
| **Azure Functions <-> Key Vault** | Managed identity (automatic via app setting references) | Only needed for the API app registration's client secret |

## Entra ID App Registration Configuration

The system requires **one Entra ID app registration** for the Azure Functions API:

| Setting | Value | Purpose |
|---------|-------|---------|
| **Application ID URI** | `api://rentavehicle-api` | Audience for tokens issued to SPFx |
| **Expose an API - Scope** | `user_impersonation` | SPFx requests this scope |
| **Authorized client applications** | SharePoint Online Client Extensibility app ID (`<tenant-specific>`) | Allows SPFx to acquire tokens without user consent prompt |
| **API Permissions (Delegated)** | `Calendars.ReadWrite`, `Mail.Send`, `User.Read.All`, `Chat.ReadWrite` | For OBO flow to Graph |
| **API Permissions (Application)** | `Calendars.ReadWrite`, `Mail.Send`, `User.Read.All` | For timer-triggered background functions |
| **App Roles** | `Employee`, `Manager`, `Admin` | Mapped to Entra ID security groups; included in token claims |
| **Authentication - Platform** | Web, Redirect URI = Function App URL | For Entra ID auth on Function App |
| **Certificates & Secrets** | Client secret (stored in Key Vault) | Required for OBO token exchange |

## Build Order (Dependency Chain)

Components must be built in this order because each layer depends on the one before it:

### Phase 1: Foundation (no dependencies)

1. **Entra ID app registration** -- everything else authenticates through this
2. **Azure SQL Database** provisioning and schema (EF Core migrations)
3. **Equipment mailboxes** for initial vehicles (Exchange Online PowerShell)

*Rationale:* These are infrastructure prerequisites. The app registration must exist before Azure Functions can validate tokens or do OBO. The database must exist before the API can store data. Equipment mailboxes must exist before calendar events can be created.

### Phase 2: API Layer (depends on Phase 1)

4. **Azure Functions API** -- core CRUD endpoints for vehicles, bookings, locations
5. **Managed identity connection** to Azure SQL
6. **Entra ID authentication middleware** on Function App (validates SPFx tokens)
7. **Graph API integration** (OBO flow for calendar events, notifications)

*Rationale:* The API is the central hub. It must work and be testable (via Postman/REST client) before the frontend is built. Building API-first allows parallel frontend development once contracts are established.

### Phase 3: Frontend (depends on Phase 2)

8. **SPFx solution scaffolding** with AadHttpClient configuration
9. **webApiPermissionRequests** in package-solution.json + admin consent
10. **Vehicle browsing UI** (read-only, simplest flow)
11. **Booking flow UI** (create booking, confirmation)
12. **My Rentals / history UI**

*Rationale:* SPFx depends on a working API to develop against. Start with read-only views (vehicle browsing) to validate the full auth chain end-to-end before tackling write operations.

### Phase 4: Advanced Features (depends on Phase 3)

13. **Manager views** (team rentals, notifications)
14. **Admin panel** (CRUD vehicles, manage bookings, reporting)
15. **Timer-triggered functions** (return reminders, location sync)
16. **Calendar view** (availability visualization)
17. **Reporting dashboards** (utilization, trends)

*Rationale:* These features build on top of the core booking flow. Manager and admin views require the same API but different UI and authorization checks. Timer-triggered functions are independent of the UI and can be built in parallel once the API and database are stable.

### Build Order Dependency Diagram

```
Phase 1: Foundation
  ├── Entra ID App Registration ────┐
  ├── Azure SQL + Schema ───────────┤
  └── Equipment Mailboxes ──────────┤
                                    ▼
Phase 2: API Layer
  ├── Azure Functions + Auth ───────┤
  ├── Core CRUD Endpoints ──────────┤
  └── Graph API (OBO) ─────────────┤
                                    ▼
Phase 3: Frontend (SPFx)
  ├── SPFx Scaffold + Auth ─────────┤
  ├── Vehicle Browse UI ────────────┤
  ├── Booking Flow UI ──────────────┤
  └── My Rentals UI ────────────────┤
                                    ▼
Phase 4: Advanced
  ├── Manager Views ────────────────┤
  ├── Admin Panel ──────────────────┤
  ├── Timer Functions ──────────────┤ (can parallel with Manager/Admin)
  └── Reporting ────────────────────┘
```

## Sources

- [Connect to Entra ID-secured APIs in SPFx solutions (AadHttpClient)](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient) -- Microsoft Learn, updated October 2025 -- HIGH confidence
- [Consume enterprise APIs secured with Azure AD in SPFx](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient-enterpriseapi) -- Microsoft Learn, updated December 2025 -- HIGH confidence
- [On-behalf-of flows with MSAL.NET](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/web-apps-apis/on-behalf-of-flow) -- Microsoft Learn -- HIGH confidence
- [Microsoft identity platform and OAuth2.0 On-Behalf-Of flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) -- Microsoft Learn -- HIGH confidence
- [Connect a function app to Azure SQL with managed identity](https://learn.microsoft.com/en-us/azure/azure-functions/functions-identity-access-azure-sql-with-managed-identity) -- Microsoft Learn -- HIGH confidence
- [Manage resource mailboxes in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes) -- Microsoft Learn, updated August 2025 -- HIGH confidence
- [Working with calendars and events using Graph API](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0) -- Microsoft Learn -- HIGH confidence
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) -- Microsoft Learn -- HIGH confidence
- [SPFx roadmap update November 2025](https://devblogs.microsoft.com/microsoft365dev/sharepoint-framework-spfx-roadmap-update-november-2025/) -- Microsoft 365 Developer Blog -- HIGH confidence
- [Azure SQL bindings for Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-azure-sql) -- Microsoft Learn -- HIGH confidence
- [Implement On-Behalf-Of Flow using C# Azure Function](https://aakashbhardwaj619.github.io/2021/07/27/Azure-Function-CSharp-OBO.html) -- Community (verified against official docs) -- MEDIUM confidence
- [Securing an Azure Function with Entra ID and calling it from SPFx](https://www.rlvision.com/blog/securing-an-azure-function-with-entra-id-and-calling-it-from-spfx/) -- Community blog -- MEDIUM confidence
- [Authenticate to Graph in Azure Functions with Managed Identities Part 2 (2025)](https://powers-hell.com/2025/03/10/authenticate-to-graph-in-azure-functions-with-managed-identites-2/) -- Community blog, March 2025 -- MEDIUM confidence

---
*Architecture research for: Internal vehicle rental system on M365/Azure*
*Researched: 2026-02-22*
