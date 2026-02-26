# Case 1 — SharePoint Developer Senior: Answers

## 1. How do you structure the solution and which components do you choose and why?

### Chosen Architecture: SPFx Web Part + Azure Functions + Azure SQL

The solution is a two-tier architecture deployed entirely within the M365/Azure ecosystem:

**Frontend — SharePoint Framework (SPFx) Web Part**
- A single-page React application packaged as an SPFx web part
- Hosted on SharePoint Online and deployable as a Teams personal app (same package, zero extra code)
- Uses `AadHttpClient` from `@microsoft/sp-http` for token acquisition — the SPFx runtime handles OAuth silently, so users never see a login prompt
- 32 React components organized by feature: VehicleBrowse, VehicleDetail, MyBookings, FleetManagement, Reports, TeamBookings, etc.
- A centralized `ApiService` singleton wraps all HTTP calls with typed methods

**Backend — Azure Functions (Node.js, TypeScript)**
- Serverless HTTP-triggered functions (11 endpoint files) handling business logic, data access, and integrations
- Chosen over App Service because: pay-per-execution cost model, zero infrastructure management, and native integration with Azure AD Easy Auth
- Services layer (`bookingService.ts`, `vehicleService.ts`, etc.) keeps business logic testable and separate from HTTP concerns
- Microsoft Graph SDK for calendar events, email notifications, and Teams activity feed

**Database — Azure SQL**
- Relational database with 4 core tables: Locations, Categories, Vehicles, Bookings
- Chosen for SERIALIZABLE transaction support (critical for double-booking prevention), relational integrity via foreign keys, and complex reporting queries (utilization rates, trends, joins)

**Alternative options considered at a high level:**

| Option | Pros | Cons |
|--------|------|------|
| **SharePoint Lists as data store** | Zero Azure cost, native M365, no backend needed | 5,000-item threshold, no transactions, poor for concurrent bookings, limited query capabilities |
| **Power Apps + Power Automate** | Low-code, fast to build | Limited UI customization, licensing cost per user, connector limits, hard to implement SERIALIZABLE booking logic |
| **SPFx + direct Graph API (no backend)** | Simpler architecture | Delegated permissions only (no app-level calendar access), business logic in the browser, no transaction safety |

The SPFx + Azure Functions + Azure SQL approach was chosen because it gives full control over the booking transaction logic, supports both delegated and application-level Graph API permissions, and scales with the serverless model.

---

## 2. How would you solve the time zone challenge regarding different locations of the company?

The timezone strategy follows a **"store UTC, display local"** pattern with location-aware rendering:

**Storage layer:**
- All `startTime` and `endTime` values are stored as `DATETIME2` in UTC in Azure SQL
- Each location row has a `timezone` column (`NVARCHAR(64)`) storing an IANA timezone identifier (e.g., `'Europe/Bucharest'`, `'America/New_York'`)
- The timezone identifier is returned alongside every vehicle and booking response from the API (`locationTimezone` field)

**Frontend conversion:**
- A custom `useTimezone` React hook (`hooks/useTimezone.ts`) provides memoized formatters using the browser's `Intl.DateTimeFormat` API with the `timeZone` parameter
- Three formatters are created per location: DateTime, DateOnly, TimeOnly — all automatically handle DST transitions
- When creating a booking, the `localToUtcIso()` helper converts the user's selected local time (in the location's timezone) to a UTC ISO string before sending to the API
- The timezone abbreviation (e.g., "EET", "EEST") is extracted and displayed next to times so users know which timezone they're looking at

**Why this approach:**
- UTC storage eliminates ambiguity — a booking at 14:00 UTC is always 14:00 UTC regardless of who reads it
- IANA identifiers (not fixed UTC offsets) handle daylight saving transitions correctly — `Europe/Bucharest` automatically switches between EET (+2) and EEST (+3)
- The `Intl` API is built into all modern browsers — no third-party date library needed, keeping the SPFx bundle small
- Location-scoped timezone display means an employee in New York booking a vehicle in Bucharest sees Bucharest times, not their own timezone

---

## 3. What technologies and frameworks would you use in your components and why?

**Frontend (SPFx Web Part):**

| Technology | Purpose | Why |
|-----------|---------|-----|
| **React 17** | UI framework | Ships with SPFx 1.20 — component model, hooks, virtual DOM |
| **TypeScript** | Type safety | Catches bugs at compile time, self-documenting interfaces |
| **Fluent UI v8** | UI component library | Microsoft's design system — consistent M365 look, accessibility built in |
| **CSS Modules** | Scoped styling | SPFx convention, prevents style collisions with SharePoint host page |
| **AadHttpClient** | API authentication | Built into SPFx runtime — handles token acquisition, refresh, and caching transparently |
| **Intl.DateTimeFormat** | Timezone display | Native browser API, no library dependency, DST-aware |

**Backend (Azure Functions):**

| Technology | Purpose | Why |
|-----------|---------|-----|
| **Node.js 22 + TypeScript** | Runtime | Same language as frontend (shared mental model), native Azure Functions support |
| **Zod v3** | Request validation | Runtime schema validation with TypeScript type inference — validates booking inputs (hourly precision, endTime > startTime), vehicle fields (year range, license plate length), admin cancel reasons |
| **mssql v12** | SQL Server client | Connection pooling, parameterized queries (SQL injection prevention), SERIALIZABLE transaction support |
| **Microsoft Graph SDK** | M365 integration | Calendar event creation, email notifications, Teams activity feed, user/manager lookups |
| **@azure/identity** | Authentication | `DefaultAzureCredential` for Managed Identity in production, `ClientSecretCredential` for local dev |

**Form validation specifically:** Zod schemas on the API enforce all business rules server-side (the source of truth). The frontend uses TypeScript types and manual checks (e.g., filtering past hours, validating date ranges) for immediate UX feedback — but the API never trusts the client.

---

## 4. How do you solve authentication/authorization and role-based access, and which roles does the solution need? What do you need to configure for this in Entra ID?

### Roles

The solution defines four roles in a hierarchy:

| Role | Level | Capabilities |
|------|-------|-------------|
| **Employee** | 0 | Browse vehicles, create/cancel own bookings, check out/check in vehicles |
| **Manager** | 1 | Everything Employee can do + view direct reports' bookings (via Graph API `/directReports`) |
| **Admin** | 2 | Everything Manager can do + fleet management (CRUD vehicles/categories), admin-cancel bookings with reason, view reports — scoped to their office location |
| **SuperAdmin** | 3 | Everything Admin can do, across all locations (no location scope restriction) |

Users with no explicit role assignment default to **Employee**.

### Entra ID Configuration

**1. App Registration (`RentAVehicle-API`):**
- Single-tenant registration (organizational directory only)
- Application ID URI: `api://<client-id>`

**2. Expose an API:**
- Scope: `user_impersonation` (display name: "Access RentAVehicle API", admin consent required)
- Authorized client application: `00000003-0000-0ff1-ce00-000000000000` (SharePoint Online Client Extensibility) — this is what allows the SPFx web part to acquire tokens via `AadHttpClient`

**3. API Permissions (Application type, not Delegated):**
- `Calendars.ReadWrite` — create/update booking events on vehicle resource mailboxes
- `Mail.Send` — send booking confirmation emails
- `User.Read.All` — read user profiles, resolve office locations, look up managers and direct reports
- `TeamsActivity.Send` — push notifications to the Teams activity feed

Application permissions are used (not delegated) because Azure Functions call Graph API with the app's own identity — for example, creating a calendar event on a vehicle's resource mailbox requires app-level access, not the booking user's permissions.

**4. App Roles (defined in manifest):**
- `SuperAdmin`, `Admin`, `Manager`, `Employee` — each defined as application roles in the app registration
- Assigned to users/groups via Enterprise Applications > Users and groups

**5. Easy Auth (Azure App Service Authentication):**
- Configured on the Azure Function App: Settings > Authentication > Microsoft identity provider
- Restrict access: Require authentication
- Unauthenticated requests: Return 401
- Easy Auth validates the token and injects an `x-ms-client-principal` header (Base64-encoded JSON) containing the user's claims and role assignments

---

## 5. Briefly explain how the authentication/authorization flows you plan to adopt work in Azure/M365.

### Flow 1: User → SPFx → Azure Functions (Employee actions)

```
User opens SharePoint page
  → SPFx web part loads (already signed in via SharePoint SSO)
  → AadHttpClient.getClient('api://<client-id>') requests a token
    → Azure AD issues an access token for scope api://<client-id>/user_impersonation
    → Token represents the signed-in user (delegated)
  → SPFx calls Azure Function with Bearer token in Authorization header
  → Easy Auth on Azure Functions validates the token
    → Injects x-ms-client-principal header with decoded claims (oid, name, email, roles)
  → API middleware (auth.ts) parses the header:
    → Extracts userId (oid claim), displayName, email
    → Extracts role claims → resolves effective role (highest in hierarchy)
    → Returns UserContext object
  → Endpoint checks role authorization (e.g., requireRole('Admin', 'SuperAdmin'))
  → Business logic executes → response returned to SPFx
```

There is no explicit login prompt — the user is already authenticated in SharePoint/Teams, and `AadHttpClient` silently acquires tokens.

### Flow 2: Azure Functions → Microsoft Graph (Backend actions)

```
Azure Function needs to call Graph API (e.g., create calendar event)
  → Production: DefaultAzureCredential uses Managed Identity
    → Azure AD issues an app-only token for https://graph.microsoft.com/.default
    → Token carries all application permissions granted in the app registration
  → Local dev: ClientSecretCredential uses tenant ID + client ID + client secret
  → Graph SDK attaches token to requests automatically
  → Graph API validates the token and checks application permissions
```

This is a **client credentials flow** (app-to-app) — no user is involved. The Azure Function acts as itself, not on behalf of a user. This is necessary for operations like writing to a vehicle's resource mailbox calendar, which the booking employee wouldn't have delegated permission to do.

### Key distinction:

- **SPFx → API**: Delegated flow (token represents the user, Easy Auth validates it)
- **API → Graph**: Application flow (token represents the app, Managed Identity authenticates it)

---

## 6. What data storage would you use? You can mention a couple of options — also mention their advantages/disadvantages.

### Chosen: Azure SQL Database

**Schema:** 4 tables — Locations, Categories, Vehicles, Bookings — with foreign key relationships and CHECK constraints.

**Why it was chosen for this solution:**
- **SERIALIZABLE transactions**: The `createBooking` function uses `ISOLATION_LEVEL.SERIALIZABLE` to atomically check-then-insert, preventing double-bookings even under concurrent requests. This is the single most important data integrity requirement.
- **Relational model**: Vehicles belong to locations and categories; bookings reference vehicles. Foreign keys enforce referential integrity at the database level.
- **Complex queries**: Reporting features (utilization rates, booking trends, fleet overview) require JOINs, GROUP BY, date aggregations — all natural in SQL.
- **Indexing**: Composite indexes on `(vehicleId, status) INCLUDE (startTime, endTime)` optimize the availability overlap check query.

### Alternative options:

| Storage | Advantages | Disadvantages |
|---------|-----------|---------------|
| **SharePoint Lists** | Zero Azure cost; native M365 integration; no backend needed for simple CRUD; built-in versioning and permissions | 5,000 item list view threshold; no transactions (double-booking risk under concurrent access); CAML/REST query limitations; poor performance for complex reporting; throttling under load |
| **Azure Cosmos DB** | Global distribution (good for worldwide company); auto-scaling; flexible JSON schema; low-latency reads | No native SERIALIZABLE transactions across partitions; eventual consistency model complicates double-booking prevention; higher cost for transactional workloads; requires careful partition key design |
| **Dataverse** | Tight Power Platform integration; built-in RBAC; audit logging; relational-like structure | Per-user licensing cost; limited SQL expressiveness; vendor lock-in to Power Platform; harder to integrate with custom Azure Functions; storage capacity limits |
| **Azure Table Storage** | Very low cost; simple key-value access; massive scale | No relational model; no transactions; no JOINs; would need application-level consistency checks; poor for the reporting requirements |

**Bottom line:** For a vehicle rental system where the #1 data integrity requirement is preventing double-bookings under concurrent access, Azure SQL with SERIALIZABLE transactions is the most appropriate choice. SharePoint Lists would work for a small single-location fleet with low concurrency but breaks down at scale. Cosmos DB is viable if global distribution is a hard requirement, but adds complexity for transactional consistency.
