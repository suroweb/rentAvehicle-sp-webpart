# Project Research Summary

**Project:** RentAVehicle — Internal Fleet Rental System
**Domain:** Internal enterprise vehicle rental / fleet pool booking on Microsoft 365 + Azure
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

RentAVehicle is an internal corporate pool-car booking system built natively on Microsoft 365 and Azure. The product category is well-understood: enterprise fleet management vendors (Smartrak PoolCar, Autofleet, Fleetio) have established what users expect, and the M365 ecosystem provides a clear, validated architecture for this class of application. The proposed stack — SPFx for the frontend, Azure Functions for the API, Azure SQL for storage, Entra ID for identity, and Graph API for M365 integration — is the correct choice. No alternatives are worth pursuing. Every component maps directly to a documented Microsoft pattern with official guidance.

The strongest competitive advantage of this system is its native M365 integration. No commercial pool-car system creates per-vehicle Exchange equipment mailboxes, sends Adaptive Card notifications in Teams, or sources locations from the Entra ID directory. These are genuine differentiators that competitors cannot easily replicate because they require deep platform knowledge to build. The recommendation is to ship a solid MVP with the 14 table-stakes features first, then layer on the M365-native differentiators (resource calendars, Adaptive Cards, user calendar events) in v1.x once the core booking flow is proven.

The primary risks are all well-documented and preventable: double-booking race conditions (must be enforced at the database level, not the application layer), SPFx-to-Azure-Functions authentication mismatches (token audience must be validated end-to-end early), CORS conflicts between Easy Auth and preflight requests (must configure "Allow" for unauthenticated requests on the Function App), and timezone handling errors (must store IANA timezone identifiers, not UTC offsets). All of these pitfalls have clear prevention strategies documented in the research. None represent blockers — they are execution risks that must be addressed in the correct phase.

---

## Key Findings

### Recommended Stack

The stack is validated and locked. SPFx 1.22.0 with React 17.0.1 (exact, not 18) is the only framework that embeds natively in both SharePoint and Teams. Azure Functions on the Flex Consumption plan provides cost-effective serverless API hosting with native timer triggers, managed identity support, and near-zero cost when idle. Azure SQL Database on the Serverless tier ($5-15/month) is the correct relational store — SharePoint Lists fail at 5,000 items and cannot perform JOIN queries; Cosmos DB is over-engineered for relational booking data. Managed identity eliminates secrets from the database connection entirely.

One critical version constraint governs the entire frontend: React must be pinned to 17.0.1 using `--save-exact`. React 18 causes silent runtime failures in SPFx 1.22. Similarly, Fluent UI v8 (ships with SPFx) must be the primary UI library; v9 has known rendering issues (Dialog renders outside webpart context, FluentProvider scoping problems) and is not officially supported.

**Core technologies:**
- **SPFx 1.22.0 + React 17.0.1 (exact):** Frontend framework — only option for native SharePoint + Teams embedding; Heft replaces gulp as of 1.22
- **Azure Functions Runtime 4.x + Node.js 22 LTS:** API layer — pay-per-execution pricing, native timer triggers, managed identity; Flex Consumption plan for reduced cold starts
- **Azure SQL Database (Serverless, General Purpose):** Primary data store — relational model required for overlap queries, reporting JOINs, and referential integrity; auto-pause reduces cost to ~$5-15/month
- **Microsoft Entra ID:** Identity and RBAC — SSO for all M365 users, app roles (Employee/Manager/Admin) enforced at API layer
- **Microsoft Graph API v1.0 + @microsoft/microsoft-graph-client 3.0.7:** M365 integration — calendar events on equipment mailboxes, email/Teams notifications, user/location data; do NOT use the preview msgraph-sdk
- **Fluent UI v8, @pnp/spfx-controls-react 3.23.0, date-fns-tz:** Supporting libraries — native SharePoint UX, pre-built controls, timezone-safe date handling

### Expected Features

The research identified 16 table-stakes features, 8 differentiators, and 8 anti-features to explicitly exclude. The feature dependency tree is clear: authentication (T9) is the foundation, RBAC (T10) gates everything else, and the booking creation + double-booking prevention (T3 + T4) is the core value chain.

**Must have (v1 table stakes):**
- T9: Entra ID SSO — no separate credentials, mandatory for M365 app
- T10: Role-Based Access Control (Employee / Manager / Admin) — enforced at API, not UI
- T16: SPFx Webpart — dual deployment: SharePoint pages and Teams tab
- T1: Vehicle browsing with filters (location, date/time range, category)
- T2: Vehicle detail view (make, model, plate, photo)
- T3: Booking creation — core action; must be rock-solid
- T4: Double-booking prevention — database-level constraint, not application-level check
- T15: Timezone-correct display — IANA identifiers in DB; show vehicle-location timezone in UI
- T5: Booking confirmation via email (Graph API)
- T7: My bookings view (upcoming, active, past)
- T11-T14: Admin CRUD — vehicle management, status, view all bookings, cancel/override

**Should have (v1.x differentiators):**
- T8: Availability calendar view — high-value visual; FullCalendar or similar React component
- T6: Return reminders — timer-triggered Azure Function
- D1: Vehicle resource calendars in Outlook (Exchange equipment mailboxes) — the biggest M365 differentiator; no competitor does this natively
- D3: User Outlook calendar events created on booking
- D2: Teams Adaptive Card notifications — replaces plain email
- D5: Location sync from Entra ID directory — eliminates manual admin overhead
- D7: Check-in / check-out workflow — closes the gap between "booked" and "in use"

**Defer to v2+:**
- D4: Manager team dashboard — needs org hierarchy integration; use admin view initially
- D6: Reporting and analytics dashboard — needs booking history to be meaningful; export to Excel covers early needs
- D8: Conflict-aware booking suggestions — polish feature, only matters at scale

**Explicitly excluded (anti-features):**
- A1: Approval workflows — destroys self-service value; add manager visibility instead
- A2: GPS / real-time tracking — requires hardware; massive scope increase
- A3: Automated maintenance scheduling — this is a fleet maintenance product, not a booking system
- A4: Payment / cost allocation — complexity without validated need; export data for offline allocation
- A5: Native mobile app — Teams mobile covers this; SPFx is already responsive

### Architecture Approach

The architecture follows a clean 4-layer pattern: SPFx webpart (UI) communicates with Azure Functions (API) via AadHttpClient with bearer tokens; Azure Functions authenticate to Azure SQL via managed identity and to Graph API via OBO flow (user-initiated) or client credentials (background tasks); Exchange equipment mailboxes serve as the Outlook-visible calendar layer for vehicle bookings. This is a standard enterprise M365 architecture with well-documented patterns and official Microsoft guidance for every integration point.

The critical architectural decision: Azure SQL is the single source of truth. Equipment mailboxes are a write-through display layer — the application writes to SQL first, then pushes to the resource calendar via Graph API. The calendar is never read back as authoritative. This avoids the webhook subscription limitation on resource mailboxes (webhooks are not supported on equipment mailboxes) and keeps the system simple.

**Major components:**
1. **SPFx Webpart (React + Fluent UI v8)** — UI shell; client-side routing between views (Browse, Book, My Rentals, Admin); AadHttpClient for authenticated API calls; no business logic
2. **Entra ID App Registration** — API app with `user_impersonation` scope, app roles (Employee/Manager/Admin), delegated + application Graph permissions; single registration for the Function App
3. **Azure Functions API** — domain-grouped functions (Vehicles, Bookings, Locations, Admin, Notifications); Entra ID auth middleware; OBO flow for user-context Graph calls; timer triggers for background tasks
4. **Azure SQL Database** — vehicles, bookings, locations, audit log; managed identity connection; database-level overlap constraints for double-booking prevention
5. **Microsoft Graph API** — calendar events on equipment mailboxes, confirmation emails, Teams messages, user/location data from directory
6. **Exchange Online Equipment Mailboxes** — one per vehicle; created via PowerShell (`New-Mailbox -Equipment`); mailbox SMTP address stored in vehicle record in Azure SQL

### Critical Pitfalls

The research identified 7 critical pitfalls. All are preventable with upfront design decisions.

1. **Token audience mismatch (SPFx to Azure Functions)** — Decode an actual SPFx token using jwt.io, then configure the Function App's "Allowed token audiences" to match exactly. Validate the full auth chain as the first integration milestone in Phase 1. Recovery is low-cost (no code change needed), but 401 errors in production destroy confidence.

2. **Double-booking race condition** — Implement a `SELECT ... WITH (UPDLOCK, HOLDLOCK)` pessimistic lock within a serializable transaction on booking creation, plus a database-level constraint preventing overlapping date ranges for the same vehicle. Application-level checks alone will fail under concurrent load. This is non-negotiable — retrofitting the constraint after data corruption is painful.

3. **CORS + Easy Auth conflict on preflight requests** — Set "Unauthenticated requests" to "Allow (HTTP 401)" on the Function App, configure CORS in the Azure portal (not in function code), and allow the SharePoint tenant origin. Test from a deployed SharePoint page, not localhost, before calling Phase 1 done.

4. **Equipment mailboxes cannot be created via Graph API** — Plan a PowerShell-based provisioning workflow (`New-Mailbox -Equipment`) from the start. Store the mailbox SMTP address in the vehicle record in Azure SQL. Graph API handles event CRUD after mailbox creation; it cannot create the mailbox itself. This is an Exchange Online PowerShell-only operation.

5. **Resource mailboxes do not support webhook subscriptions** — Treat the Exchange calendar as a write-through display layer. All sync is one-directional: application writes to SQL, then pushes to the equipment mailbox via Graph API. No webhook-based sync; use polling only if external calendar changes need to be detected.

6. **Timezone errors for global fleets** — Store IANA timezone identifiers (e.g., `Europe/Berlin`) in the locations table, not UTC offsets. Store all booking timestamps as UTC in Azure SQL (`datetimeoffset` type). Display in the vehicle's location timezone, not the user's browser timezone. Use date-fns-tz or Luxon. Never use `new Date().getTimezoneOffset()` for business logic. Recovery from wrong timezone storage is a HIGH-cost migration.

7. **Tenant-wide SPFx API permissions** — Permissions granted via `webApiPermissionRequests` apply to the entire tenant's SharePoint Online Client Extensibility principal, not just this web part. Request minimum scopes. Route elevated/admin operations through the Function App's own app registration with application permissions, not through SPFx declarative permissions.

---

## Implications for Roadmap

Based on the architecture's dependency chain (ARCHITECTURE.md Phase 1-4 build order) and the feature prioritization matrix (FEATURES.md), the following phase structure is recommended.

### Phase 1: Infrastructure and Authentication Foundation

**Rationale:** Every subsequent component depends on identity, data storage, and the SPFx-to-API auth chain. The most critical pitfalls (token audience mismatch, CORS + Easy Auth conflict, tenant-wide permissions, timezone storage schema) must be resolved before any feature work begins. Building this phase first de-risks the entire project.

**Delivers:**
- Entra ID app registration configured (application ID URI, `user_impersonation` scope, app roles, API permissions)
- Azure SQL Database provisioned with initial schema (Vehicles, Bookings, Locations, AuditLog tables with correct data types including `datetimeoffset` and IANA timezone columns)
- Azure Functions app deployed on Flex Consumption with managed identity to Azure SQL and Easy Auth configured
- SPFx solution scaffolded, AadHttpClient configured, `webApiPermissionRequests` in `package-solution.json`, admin consent granted
- End-to-end auth chain validated: SPFx webpart calls Azure Function, token decoded and inspected, role claims verified
- CORS validated from deployed SharePoint page with auth enabled
- Exchange equipment mailbox provisioning approach decided; PowerShell script drafted; at least one test vehicle mailbox created

**Addresses:** T9 (Auth), T10 (RBAC foundation), T16 (SPFx shell)
**Avoids:** Pitfalls 1 (token mismatch), 3 (CORS), 4 (mailbox via Graph), 7 (tenant-wide permissions)

**Research flag:** This phase has well-documented Microsoft patterns. Standard implementation — skip phase research. The pitfalls are known and preventable with reference implementations.

### Phase 2: Core Booking Flow (MVP)

**Rationale:** T3 (booking creation) + T4 (double-booking prevention) is the core value chain. Every other feature either feeds into booking creation or consumes booking data. This phase must be completed before notifications, calendar sync, or admin features are meaningful.

**Delivers:**
- Vehicle browsing with location + date/time filters (T1) — availability overlap query in Azure SQL
- Vehicle detail view (T2)
- Booking creation form with optimistic UI (T3)
- Database-level double-booking prevention: pessimistic lock + overlap constraint (T4)
- Timezone-correct date/time display throughout (T15) — vehicle location timezone, not browser timezone
- Booking confirmation email via Graph API (T5)
- My Bookings view — upcoming, active, past (T7)
- Connection pool singleton pattern validated; API load-tested

**Addresses:** T1, T2, T3, T4, T5, T7, T15
**Avoids:** Pitfalls 2 (double-booking), 6 (timezone errors), connection pool exhaustion
**Uses:** Azure SQL overlap queries, Graph API Mail.Send, date-fns-tz

**Research flag:** The double-booking prevention mechanism (serializable transactions, `UPDLOCK`/`HOLDLOCK`, or application-level reservation TTL pattern) warrants research-phase during planning to select the correct Azure SQL implementation approach.

### Phase 3: Admin Capabilities

**Rationale:** The admin panel (T11-T14) enables fleet administrators to manage inventory and resolve issues. It depends on the core booking flow (Phase 2) being stable. Admin features share the same API but require role enforcement to be airtight.

**Delivers:**
- Vehicle CRUD (T11) — add, edit, retire vehicles; includes provisioning trigger for equipment mailboxes
- Vehicle status management: available / in maintenance / retired (T12)
- Admin view of all bookings across locations and users (T13)
- Admin cancel/override bookings with reason and employee notification (T14)
- Role enforcement penetration test: regular employee cannot call admin endpoints

**Addresses:** T11, T12, T13, T14
**Avoids:** Client-side role trust pitfall — enforce 403 at API layer

**Research flag:** Standard CRUD with role enforcement — well-documented patterns. Skip phase research.

### Phase 4: M365-Native Differentiators (v1.x)

**Rationale:** These features are what makes this product superior to commercial alternatives. They require the core booking flow (Phase 2) and admin capabilities (Phase 3) to be stable, plus Exchange Online admin coordination for equipment mailboxes. Shipping these in v1.x gives the product its strongest competitive position.

**Delivers:**
- Availability calendar view (T8) — timeline/calendar grid per vehicle using FullCalendar or similar React component
- Return reminders: timer-triggered Azure Function (T6) — runs hourly, queries upcoming returns, sends Graph API emails
- Vehicle resource calendars in Outlook: booking events on equipment mailboxes via Graph API (D1) — the biggest M365 differentiator
- User Outlook calendar events on booking (D3) — Graph API `POST /users/{id}/events`
- Teams Adaptive Card notifications (D2) — replaces plain email confirmations
- Location sync from Entra ID directory: daily timer-triggered function (D5)
- Check-in / check-out workflow (D7) — status transitions: Reserved -> Checked Out -> Returned

**Addresses:** T6, T8, D1, D2, D3, D5, D7
**Avoids:** Pitfall 5 (webhook subscriptions on resource mailboxes — Azure SQL is source of truth, Graph is write-through)
**Uses:** Graph API OBO flow for user-context calendar events; application permissions for timer-triggered reminders

**Research flag:** D1 (resource calendars) and D2 (Adaptive Cards) need research-phase during planning. D1 requires Exchange Online admin coordination and specific CalendarProcessing configuration. D2 requires Teams Bot Framework or Graph API chat messaging, which has multiple implementation paths with different trade-offs.

### Phase 5: Analytics and Advanced Features (v2+)

**Rationale:** Reporting dashboards (D6) require booking history to be meaningful. Manager org-hierarchy integration (D4) requires validating Entra ID `/directReports` data quality. Conflict-aware suggestions (D8) are polish features that only matter at scale.

**Delivers:**
- Reporting / analytics dashboard (D6) — utilization rates, bookings per location, most-used vehicles, CSV/Excel export; pre-computed aggregations in Azure SQL
- Manager team visibility dashboard (D4) — direct reports' bookings via Entra ID org hierarchy
- Conflict-aware booking suggestions (D8) — alternative vehicles and time slots when primary is unavailable

**Addresses:** D4, D6, D8

**Research flag:** D6 (reporting) warrants research-phase — specifically whether to use Power BI embedded vs. custom React charts (Chart.js/Recharts) vs. Azure SQL views/stored procedures for pre-aggregation. The choice depends on org licensing and acceptable development complexity.

### Phase Ordering Rationale

- **Infrastructure first:** Token audience mismatch, CORS + Easy Auth, and timezone schema are the three pitfalls with the highest recovery cost if discovered late. Phase 1 catches all three before any feature code is written.
- **Core booking second:** The feature dependency tree (FEATURES.md) shows T3 (booking) is the trunk — all other features branch from it. Getting booking creation correct, including the double-booking constraint, must happen before admin and notification layers.
- **Admin before differentiators:** Fleet managers need to load the vehicle inventory (T11-T12) before resource calendars (D1) are meaningful. Admin capabilities are also simpler (same API, different role) and validate the RBAC enforcement before the more complex Graph API integration work.
- **Differentiators after core:** D1 (resource calendars) and D3 (user calendar events) require the booking flow to be stable because they are triggered on booking creation. Building them in Phase 4 avoids rework if the booking API changes.
- **Analytics last:** D6 requires historical data. Building it after 4+ weeks of real usage means the reporting queries will be designed against actual data patterns, not hypothetical ones.

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- **Phase 2 (double-booking prevention):** Research the correct Azure SQL concurrency pattern — serializable transactions with `UPDLOCK`/`HOLDLOCK` vs. application-level reservation TTL (short-lived booking hold) vs. optimistic concurrency with row version. Each has different performance and UX trade-offs.
- **Phase 4 (D1: resource calendars):** Research Exchange Online CalendarProcessing policy options, license requirements for equipment mailboxes, and the exact Graph API flow for creating events that appear on both the vehicle's equipment mailbox and the user's personal calendar simultaneously.
- **Phase 4 (D2: Teams Adaptive Cards):** Research current options for sending Adaptive Cards to Teams users — Graph API chat messages vs. Teams Bot Framework vs. incoming webhooks — and the associated app registration requirements and admin consent flows.
- **Phase 5 (D6: reporting dashboard):** Research Power BI embedded vs. custom React charting vs. pre-aggregated Azure SQL views. Evaluate org licensing (Power BI Pro vs. Premium) before committing to an approach.

**Standard patterns (skip research-phase):**
- **Phase 1 (Infrastructure):** Well-documented Microsoft patterns for Entra ID app registration, SPFx AadHttpClient, Azure Functions managed identity, and Easy Auth CORS configuration. Use official Microsoft Learn docs directly.
- **Phase 3 (Admin CRUD):** Standard CRUD with role enforcement. No novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official Microsoft docs and npm. Compatibility matrix for SPFx 1.22 is authoritative. The React 17.0.1 exact-pin requirement is critical and well-documented. |
| Features | HIGH | Table-stakes features validated against 3+ commercial fleet management competitors. Anti-features validated against known product failures (approval workflows killing adoption, GPS scope creep). Dependency tree is grounded in the architecture. |
| Architecture | HIGH | All integration patterns sourced from Microsoft Learn official docs, updated October-December 2025. OBO flow, managed identity, AadHttpClient, and equipment mailboxes are all officially documented and actively maintained patterns. |
| Pitfalls | HIGH | Pitfalls sourced from official Microsoft docs, GitHub issues from the SPFx and node-mssql repos, and multiple practitioner blogs. The tenant-wide permissions, CORS + Easy Auth conflict, and resource mailbox limitations are all verified against official sources. |

**Overall confidence: HIGH**

### Gaps to Address

- **Azure Functions language runtime for this project:** The STACK.md specifies Node.js 22 + TypeScript for Azure Functions, while the ARCHITECTURE.md project structure shows `.cs` files and EF Core, implying C# / .NET 8. The implementation language for Azure Functions must be decided and made consistent. **Recommendation: Node.js 22 + TypeScript** to share the same runtime and language as the SPFx frontend, reduce cognitive overhead, and simplify the monorepo build. Use `tedious` for Azure SQL and `@azure/msal-node` for OBO flow. Revisit only if complex business logic warrants the EF Core migration tooling benefit.
- **Exchange mailbox licensing requirement:** Research confirmed that equipment mailboxes may require an Exchange Online license (or at minimum a resource mailbox license). Confirm the tenant's current Exchange Online licensing before committing to the D1 differentiator in the roadmap. If licensing is unavailable, the fallback is a shared calendar maintained by the application.
- **Fluent UI v9 incremental adoption:** The stack recommends v8 as primary but notes v9 can be introduced for specific components. No decision on which components (if any) should use v9 has been made. This can be deferred to implementation.
- **@pnp/spfx-controls-react 3.23.0 compatibility with SPFx 1.22 Heft build:** Version compatibility note in STACK.md says "verify 1.22 Heft compat." Validate this in Phase 1 infrastructure spike before committing to the library.

---

## Sources

### Primary (HIGH confidence)
- [SPFx 1.22 release notes](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22) — Version details, Heft toolchain requirement, React 17.0.1 exact pin
- [SPFx compatibility matrix](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) — Node.js 22, TypeScript 5.8, React 17.0.1 confirmed
- [Connect to Entra ID-secured APIs in SPFx (AadHttpClient)](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient) — Updated October 2025; official SPFx-to-API auth pattern
- [Azure Functions runtime versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions) — Runtime 4.x, Node.js 22 support
- [Azure Functions Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan) — Plan features, cold start mitigation, pricing
- [Azure SQL serverless tier overview](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview) — Auto-pause, cost model (~$5-15/month for internal app)
- [SharePoint 5,000 item threshold](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/lists-and-libraries/items-exceeds-list-view-threshold) — Hard limit; eliminates SharePoint Lists as data store
- [Manage resource mailboxes in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes) — Updated August 2025; equipment mailbox creation via PowerShell
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) — Minimum scopes for calendar, mail, chat operations
- [On-behalf-of flow (MSAL)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) — OBO token exchange for user-context Graph calls
- [Connect Functions to Azure SQL with managed identity](https://learn.microsoft.com/en-us/azure/azure-functions/functions-identity-access-azure-sql-with-managed-identity) — Passwordless DB connection
- [Changes on SPFx permission grants in Entra ID](https://devblogs.microsoft.com/microsoft365dev/changes-on-sharepoint-framework-spfx-permission-grants-in-microsoft-entra-id/) — Tenant-wide permission pitfall; March 2025 update on SharePoint Online Web Client Extensibility principal
- [Manage connections in Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/manage-connections) — Connection pool singleton pattern; official guidance
- [SPFx roadmap January 2026](https://devblogs.microsoft.com/microsoft365dev/sharepoint-framework-spfx-roadmap-update-january-2026/) — SPFx 1.23 (March 2026), 1.24 (May 2026) planned changes

### Secondary (MEDIUM confidence)
- [Securing Azure Functions with Entra ID for SPFx — Voitanos](https://www.voitanos.io/blog/securing-an-azure-function-app-with-azure-ad-works-with-with-sharepoint-framework/) — AadHttpClient + OBO pattern; Andrew Connell is authoritative in SPFx community
- [Consider avoiding declarative permissions — Voitanos](https://www.voitanos.io/blog/consider-avoiding-declarative-permissions-with-azure-ad-services-in-sharepoint-framework-projects/) — Tenant-wide SPFx permissions pitfall; detailed practitioner analysis
- [node-mssql Connection Pools and Azure Functions — GitHub Issue #942](https://github.com/tediousjs/node-mssql/issues/942) — Connection pool singleton pattern for Node.js Functions
- [Cold Starts in Azure Functions — Mikhail Shilkov](https://mikhail.io/serverless/coldstarts/azure/) — Cold start measurements and mitigation strategies
- [Smartrak PoolCar feature set](https://smartrak.com/poolcar/) — Competitor feature baseline
- [Autofleet Motor Pool Management](https://autofleet.io/motor-pool-management-and-corporate-car-sharing) — Competitor feature baseline
- [CORS issue accessing Azure Function from SPFx — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/178011/cors-issue-while-accessing-azure-function-from-spf) — CORS + Easy Auth conflict documentation

---

*Research completed: 2026-02-22*
*Ready for roadmap: yes*
