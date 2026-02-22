# Pitfalls Research

**Domain:** M365/Azure Internal Vehicle Rental System (SPFx + Azure Functions + Azure SQL)
**Researched:** 2026-02-22
**Confidence:** HIGH (verified across official Microsoft docs, community issues, and multiple practitioner sources)

## Critical Pitfalls

### Pitfall 1: SPFx API Permission Grants Are Tenant-Wide, Not Component-Scoped

**What goes wrong:**
Developers assume that declaring API permissions in `package-solution.json` scopes those permissions to their SPFx web part. In reality, permissions are granted to the **SharePoint Online Client Extensibility** service principal (or the newer **SharePoint Online Web Client Extensibility** principal as of March 2025), not to the individual SPFx component. Every SPFx solution in the tenant shares the same permission set. Uninstalling a solution does NOT revoke its permission grants.

**Why it happens:**
The admin consent UI in SharePoint shows which SPFx package *requested* a permission, implying the permission is tied to that component. This visual association is misleading. Microsoft's documentation buries this nuance.

**How to avoid:**
- Treat SPFx API permissions as a tenant-wide concern. Audit what permissions the SharePoint Online Client Extensibility principal has before adding more.
- Use the principle of least privilege: request only the Graph API scopes the app actually needs (e.g., `Calendars.ReadWrite` for vehicle calendars, not `Calendars.ReadWrite.All`).
- For operations requiring elevated or application-level permissions (admin reporting, bulk operations), route through Azure Functions using application permissions on a separate app registration, NOT through SPFx declarative permissions.
- Document which SPFx permissions exist in the tenant and why.

**Warning signs:**
- Multiple SPFx solutions requesting overlapping or broad Graph scopes.
- Developers requesting `Sites.FullControl.All` or `Mail.ReadWrite` "just to make it work."
- No tracking of which permissions were granted for which solution.

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- establish the Entra ID app registration and permission model before writing any SPFx code.

---

### Pitfall 2: Token Audience Mismatch Between SPFx AadHttpClient and Azure Function

**What goes wrong:**
SPFx web part calls Azure Function secured by Entra ID authentication and gets HTTP 401 errors. The token's `aud` (audience) claim does not match what the Azure Function expects. Developers spend hours debugging because the error message ("token not valid for the intended resource") does not identify which audience was expected vs. received.

**Why it happens:**
When configuring Entra ID authentication on the Azure Function App (via App Service Authentication / "Easy Auth"), the default audience configuration does not match the token that SPFx's `AadHttpClient` actually issues. SPFx obtains tokens using the SharePoint Online Client Extensibility principal, and the `aud` claim format may be the Application ID URI (`api://...`) or just the client ID GUID -- these are different values, and misconfiguration of either side causes rejection.

**How to avoid:**
- After configuring Easy Auth on the Function App, decode an actual token from SPFx using [jwt.io](https://jwt.io) and check the `aud` value.
- Set the Function App's "Allowed token audiences" to include the exact value from the decoded token.
- In the Azure Function App's authentication settings, explicitly allow client ID `08e18876-6177-487e-b8b5-cf950c1e598c` (the SharePoint Online Client Extensibility principal).
- Set the Function App's authorization level to `Anonymous` since App Service Authentication handles auth before the function code runs.
- Test the full SPFx-to-Function auth flow early in development, not as an afterthought.

**Warning signs:**
- 401 errors from the Azure Function that disappear when authentication is removed.
- Token works in Postman but fails from SPFx.
- Different behavior between `api://` format and GUID-only format in audience config.

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- set up and validate the SPFx-to-Azure-Functions auth flow as the first integration milestone.

---

### Pitfall 3: Double-Booking Race Condition on Concurrent Vehicle Reservations

**What goes wrong:**
Two employees simultaneously check availability for the same vehicle at the same time slot. Both see it as available. Both submit bookings. Both succeed. The vehicle is double-booked. This is a classic TOCTOU (Time-of-Check to Time-of-Use) race condition.

**Why it happens:**
Developers implement availability checking as a SELECT query (is vehicle available?) followed by a separate INSERT (create the booking). Between the SELECT and INSERT of one transaction, another transaction's SELECT also reads the vehicle as available. Without database-level concurrency control, both INSERTs succeed.

**How to avoid:**
- Implement a database-level unique constraint or exclusion constraint that prevents overlapping time ranges for the same vehicle. In Azure SQL, use a CHECK constraint with a scalar function, or a trigger that validates no overlapping bookings exist within a serializable transaction.
- Use pessimistic locking: wrap the availability check + booking insert in a single transaction with `SELECT ... WITH (UPDLOCK, HOLDLOCK)` on the vehicle's booking rows. This locks the relevant rows so the second concurrent request blocks until the first completes.
- Consider an optimistic concurrency approach with a version column on the vehicle availability record -- the INSERT/UPDATE fails if the version changed between read and write.
- At minimum, use `SERIALIZABLE` isolation level for the booking transaction to prevent phantom reads.
- The Azure SQL approach is sufficient for this system's scale (corporate fleet, not airline ticketing). Redis/distributed locking is overkill here.

**Warning signs:**
- Booking creation logic uses separate "check availability" and "create booking" queries without a transaction.
- No database constraints preventing overlapping date ranges for the same vehicle.
- QA cannot reproduce the issue because it requires truly concurrent requests.

**Phase to address:**
Phase 2 (Core Booking Logic) -- this must be designed into the data model and booking API from day one, not retrofitted.

---

### Pitfall 4: Graph API Cannot Create Room/Equipment Mailboxes Programmatically

**What goes wrong:**
The architecture calls for each vehicle to have an Outlook resource calendar (equipment mailbox) so bookings appear in Outlook. Developers assume they can create these equipment mailboxes via Microsoft Graph API. They cannot. Graph API does not support creating room or equipment mailboxes. The application code that attempts to provision vehicle calendars on-the-fly fails with no obvious workaround.

**Why it happens:**
Graph API supports *reading* and *managing events* on existing resource mailboxes, but mailbox creation is an Exchange Online administration operation only available through Exchange Online PowerShell (`New-Mailbox -Equipment`) or the Exchange Admin Center. This limitation is poorly documented in the Graph API calendar docs.

**How to avoid:**
- Plan a separate provisioning workflow for vehicle mailboxes using Exchange Online PowerShell (either manual admin step or a PowerShell-based Azure Function/Automation runbook).
- Design the system so that vehicle calendar creation is a one-time admin operation (fleet admin adds vehicle -> trigger equipment mailbox creation via PowerShell), not an inline API call.
- Store the equipment mailbox ID/email in the vehicle record in Azure SQL after provisioning.
- Use Graph API only for CRUD operations on calendar events after the mailbox exists.
- Consider whether resource mailboxes are worth the complexity. An alternative is maintaining bookings only in Azure SQL and rendering a calendar view in the SPFx UI, syncing to Outlook as regular calendar events on a shared calendar instead.

**Warning signs:**
- Architecture diagrams showing Graph API `POST` to create mailboxes.
- No PowerShell provisioning scripts in the project.
- Vehicle creation form with no async/admin step for mailbox setup.

**Phase to address:**
Phase 1 (Foundation/Infrastructure) for the provisioning approach decision; Phase 2 (Vehicle Management) for implementation.

---

### Pitfall 5: Resource Mailbox Webhook Subscriptions Not Supported

**What goes wrong:**
Developers build a sync mechanism that subscribes to change notifications (webhooks) on vehicle resource calendars via Graph API, expecting to be notified when bookings change. Room and equipment mailbox calendars do NOT support Graph API change notification subscriptions. The subscription creation call either fails or silently does not deliver notifications.

**Why it happens:**
Graph API subscriptions work for user mailboxes and group calendars, and the documentation does not prominently flag the resource mailbox limitation. Developers extrapolate from user calendar examples.

**How to avoid:**
- Use Azure SQL as the single source of truth for booking state, not the Exchange calendar.
- Treat the resource calendar as a *write-through display layer*: when a booking is created/modified/cancelled in Azure SQL, push the change to the resource calendar via Graph API. Do not rely on reading back from the calendar.
- If you need to detect external changes to the calendar (e.g., someone books the vehicle directly in Outlook), implement a polling mechanism using `GET /users/{mailboxId}/calendar/events` on a timer-triggered Azure Function, not webhooks.

**Warning signs:**
- Architecture that treats the Exchange calendar as the primary booking store.
- Subscription creation calls for resource mailbox IDs.
- No polling fallback in the sync design.

**Phase to address:**
Phase 2 (Core Booking + Calendar Integration) -- decide the data flow direction early.

---

### Pitfall 6: Azure Functions CORS Blocks SPFx Requests When Easy Auth Is Enabled

**What goes wrong:**
SPFx web part makes an API call to the Azure Function. The browser sends a CORS preflight `OPTIONS` request. Easy Auth (App Service Authentication) intercepts the preflight request *before* the CORS middleware processes it. The preflight request has no authentication token (by spec, preflight requests cannot carry auth headers). Easy Auth rejects it with a 401 or 302 redirect. The actual API call never executes.

**Why it happens:**
App Service Authentication sits as a middleware layer *in front of* the Azure Functions runtime. It processes every incoming request, including CORS preflight requests, before the function's CORS configuration can respond. This is a well-documented but frequently encountered issue because CORS and auth are configured in different places (Azure portal vs. function code).

**How to avoid:**
- In the Azure Function App's Authentication settings, set "Unauthenticated requests" to "Allow" (return HTTP 401 instead of redirecting to login). This lets preflight requests through while still requiring auth on actual API calls.
- Configure CORS in the Azure portal (Function App > CORS) with the SharePoint tenant origin (`https://yourtenant.sharepoint.com`).
- Do NOT handle CORS in function code when using App Service-level CORS configuration -- they conflict.
- Alternatively, handle authentication in function code (validate JWT manually) instead of using Easy Auth, giving you full control over middleware ordering.

**Warning signs:**
- CORS errors in the browser console on preflight requests.
- API works from Postman (no preflight) but fails from browser.
- 302 redirects to `login.microsoftonline.com` on OPTIONS requests.

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- validate CORS + Auth configuration as part of the initial SPFx-to-Functions integration spike.

---

### Pitfall 7: Timezone Display Errors for Global Locations

**What goes wrong:**
Bookings stored in UTC are converted to the wrong local time for display, or users in different time zones see conflicting availability. Daylight Saving Time transitions cause bookings to shift by an hour. Vehicles appear booked for the wrong time slot after a DST change. Users book a vehicle for "9:00 AM" but the system stores a different UTC time than intended because the client-side conversion used the wrong timezone identifier.

**Why it happens:**
Developers store UTC offsets (e.g., `+05:30`) instead of IANA timezone identifiers (e.g., `Asia/Kolkata`). UTC offsets are static and do not account for DST transitions. Additionally, JavaScript `Date` objects in the browser use the user's OS timezone, which may not match the vehicle's location timezone. The system must handle *two* timezones: the user's display timezone and the vehicle location's timezone.

**How to avoid:**
- Store all booking timestamps in UTC in Azure SQL (`datetimeoffset` column type).
- Store each location's IANA timezone identifier (e.g., `Europe/Berlin`, `America/New_York`) in the locations table, NOT a UTC offset.
- Convert UTC to the vehicle location's timezone for display, not the user's browser timezone. A vehicle in Berlin should show Berlin times regardless of where the viewer is.
- Use a proven timezone library (Luxon, date-fns-tz, or the Intl.DateTimeFormat API) for all conversions. Never do manual offset arithmetic.
- Handle DST edge cases explicitly: during spring-forward, 2:00 AM-3:00 AM does not exist; during fall-back, 1:00 AM-2:00 AM occurs twice.
- Write integration tests that simulate bookings across DST boundaries.

**Warning signs:**
- Location records storing `utcOffset: 5.5` instead of `timezone: "Asia/Kolkata"`.
- Using `new Date().getTimezoneOffset()` for business logic.
- No timezone-related test cases.
- Calendar display showing different times in SharePoint vs. Teams for the same booking.

**Phase to address:**
Phase 1 (Data Model Design) for the storage approach; Phase 2 (Booking UI) for conversion logic; Phase 3 (Calendar Views) for display validation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip database-level booking overlap constraints; rely on application-level checks only | Faster initial development, simpler SQL | Double-booking bugs under concurrent load; impossible to catch in single-user testing | Never -- the constraint must exist at the DB level |
| Use `fetch()` instead of `AadHttpClient` in SPFx | Avoids dealing with permission declarations and admin consent | No Entra ID token management, requires custom MSAL implementation (unsupported in SPFx), breaks on tenant policy changes | Never for Entra ID-secured endpoints |
| Store bookings only in Azure SQL, skip resource calendar sync | Eliminates Exchange mailbox provisioning and Graph API complexity | Users cannot see vehicle bookings in Outlook; loses key M365 integration value | MVP/Phase 1 only -- add calendar sync in Phase 2+ |
| Hard-code CORS origins in Azure Function code | Works immediately in development | Breaks when deploying to different environments (dev/staging/prod); conflicts with App Service CORS settings | Never -- use Azure portal CORS config or environment variables |
| Create one shared calendar for all vehicles instead of per-vehicle equipment mailboxes | Avoids Exchange Online PowerShell provisioning per vehicle | Calendar becomes unreadable at scale (50+ vehicles); no per-vehicle filtering in Outlook; conflicts with resource scheduling | Only if fleet has fewer than 10 vehicles |
| Skip connection pool singleton in Azure Functions | Less boilerplate code | Connection exhaustion under load; Azure SQL connection limit reached; intermittent database timeouts | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SPFx to Azure Functions | Using `HttpClient` or raw `fetch()` for authenticated calls | Use `AadHttpClient` from `@microsoft/sp-http` -- it handles token acquisition via the SharePoint Online Client Extensibility principal automatically |
| SPFx to Graph API | Using MSAL.js directly inside SPFx | Use the built-in `MSGraphClientV3` from `@microsoft/sp-http` -- direct MSAL usage is unsupported in SPFx since v1.4.1 |
| Azure Functions to Azure SQL | Creating a new `ConnectionPool` on every function invocation | Create a singleton connection pool at the module level (outside the function handler) so it persists across warm invocations. Use `sql.connect()` from `node-mssql` which manages a global pool |
| Azure Functions to Graph API | Using delegated permissions when the function runs without user context (e.g., timer triggers) | Use application permissions with client credentials flow for background operations (calendar sync, notifications); use on-behalf-of flow only when forwarding a user's token from SPFx |
| Graph API to Resource Calendar | Assuming resource mailboxes behave like user mailboxes | Resource mailboxes have restrictions: no webhook subscriptions, may require explicit calendar sharing permissions, booking policies controlled via `Set-CalendarProcessing` PowerShell |
| SPFx Deployment to Teams | Assuming property pane works identically in Teams personal app tab | Personal tabs have NO property pane infrastructure. Configuration must be built into the web part UI itself. Channel tabs support property pane via Teams configuration page |
| Azure SQL Migrations | Running EF Core migrations inside Azure Functions startup | EF Core design-time tooling expects ASP.NET project structure. Azure Functions' build output moves DLLs to subfolders, breaking `dotnet ef` commands. Implement `IDesignTimeDbContextFactory` and add a post-build copy step, OR run migrations from a separate CLI project |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Azure Functions cold starts on Consumption plan (Node.js/TypeScript) | First request after idle period takes 5-10 seconds; users see loading spinner for extended time on first interaction | Use Premium plan or Flex Consumption with Always Ready instances. Bundle dependencies to reduce package size. Keep function app warm with a timer-triggered health check function | Noticeable at any scale; painful when users expect responsive UI after opening the SPFx webpart |
| No connection pool limit on Azure Functions scaling | Azure SQL returns "too many connections" errors during traffic spikes. Functions scale out to many instances, each with its own pool | Set `Max Pool Size` in connection string (e.g., 30). Use Azure SQL's DTU/vCore tier appropriate for expected concurrent connections. Monitor connection counts via Azure SQL metrics | When Functions scale beyond ~10 concurrent instances on default pool settings (100 connections per pool * N instances) |
| Loading all vehicles + all bookings in a single Graph API call | Slow page loads, throttled Graph API responses (HTTP 429), SPFx web part times out | Implement server-side pagination and date-range filtering in Azure Functions. Cache vehicle list. Only fetch bookings for the visible date range. Respect Graph API throttling headers | At 50+ vehicles with 100+ bookings per month |
| SPFx bundle size bloat from heavy dependencies | Web part takes 5+ seconds to load on SharePoint pages. Teams tab shows extended loading spinner | Use dynamic imports (`import()`) for admin-only components. Tree-shake unused library features. Analyze bundle with `webpack-bundle-analyzer`. Keep main bundle under 250KB | Immediate if bundling large chart libraries, date libraries, or UI frameworks without code splitting |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-side role checks without server-side enforcement | Any user can bypass SPFx UI role checks using browser dev tools and call Azure Functions directly with admin-level operations (cancel any booking, delete vehicles) | Enforce RBAC in Azure Functions middleware by reading user claims from the token. Verify group membership / app roles from the JWT. Never rely on SPFx UI hiding buttons as security |
| Over-requesting Graph API permissions at the tenant level | All SPFx solutions in the tenant inherit the same broad permissions. A compromised or buggy SPFx component could access more data than intended | Request minimum scopes. Use application permissions on the Azure Function's own app registration for elevated operations. Audit the SharePoint Online Client Extensibility principal's permissions quarterly |
| Storing Azure SQL connection string in plain text in Function App settings | Connection string visible to anyone with Azure portal access to the Function App | Use Azure Key Vault references in Function App configuration. Better yet, use Managed Identity for Azure SQL authentication (no connection string with credentials needed) |
| Not scoping Graph API application permissions to specific mailboxes | Application with `Calendars.ReadWrite` can read/write ANY mailbox in the tenant, not just vehicle equipment mailboxes | Use Exchange Online RBAC for Applications (replaces legacy Application Access Policies) to restrict the app registration to only the vehicle equipment mailboxes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing availability in the user's browser timezone instead of the vehicle's location timezone | Employee in New York sees a vehicle in Berlin available at "3:00 AM" (Berlin's 9:00 AM) and gets confused about whether that is local or remote time | Always display times in the vehicle location's timezone with a clear timezone label (e.g., "9:00 AM CET"). Offer a toggle to view in user's local time |
| No real-time availability feedback during booking form completion | User fills out a long form, submits, then gets "vehicle no longer available" error. Frustrating when multiple vehicles are in demand | Show live availability status on the booking form. Re-validate availability on submit. Use optimistic UI with clear conflict messaging |
| SPFx web part behaves differently in Teams vs. SharePoint with no indication | Users in Teams cannot access settings/configuration that SharePoint users can. Feature gaps between hosts are invisible | Detect the host environment (`this.context.sdks.microsoftTeams`) and adapt the UI. For Teams personal tabs, embed configuration inline. Show consistent feature parity or explain limitations |
| Admin reporting loads everything client-side | Admin dashboard for 1000+ bookings freezes the browser. Export to Excel takes minutes | Implement server-side aggregation in Azure Functions. Return pre-computed utilization stats. Use streaming/pagination for exports. Push heavy computation to Azure SQL views or stored procedures |

## "Looks Done But Isn't" Checklist

- [ ] **Booking creation:** Test with two browser tabs submitting for the same vehicle/time simultaneously -- verify the database constraint rejects the second booking
- [ ] **SPFx in Teams:** Deploy the web part as a Teams tab and verify it renders, authenticates, and calls Azure Functions correctly. Test in both channel tab and personal app contexts
- [ ] **CORS + Auth:** Test from a deployed SharePoint page (not localhost) with Easy Auth enabled. Preflight requests must succeed
- [ ] **Timezone display:** Create a booking at a location in a different timezone than your own. Verify the calendar shows the correct local time for that location. Test across a DST boundary date
- [ ] **Resource calendar sync:** Create a booking through the app, then open Outlook and verify the equipment mailbox shows the correct event at the correct time
- [ ] **Connection pool under load:** Run 50+ concurrent API requests against the Azure Function and verify Azure SQL does not reject connections
- [ ] **SPFx permission admin consent:** After deploying the SPFx package, verify that API permissions have been granted in the SharePoint admin center. The web part will silently fail to get tokens if consent was not granted
- [ ] **Role enforcement on API:** Log in as a regular employee and attempt to call admin-only Azure Function endpoints directly (via curl/Postman). Verify 403 Forbidden
- [ ] **Cold start impact:** After the Function App has been idle for 20+ minutes (Consumption plan), trigger a request from SPFx and measure response time. Verify it is acceptable
- [ ] **Vehicle mailbox provisioning:** Confirm the Exchange equipment mailbox exists and is licensed before testing calendar sync. Missing license causes `ErrorItemNotFound` from Graph API

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-booking data corruption | MEDIUM | Add the database constraint retroactively. Write a SQL script to identify overlapping bookings. Manually resolve conflicts with affected users. Deploy the fix and re-test |
| Token audience mismatch (401 errors in production) | LOW | Decode a production token, update the Function App's allowed audiences in Azure portal. No code change needed. Redeploy is not required |
| Wrong timezone storage (UTC offsets instead of IANA identifiers) | HIGH | Schema migration to add timezone identifier column. Backfill from a location-to-timezone mapping. Update all display logic. Re-test every booking view |
| CORS blocking all SPFx calls | LOW | Add the SharePoint tenant origin to Function App CORS settings in Azure portal. Takes effect immediately. No redeployment |
| Connection pool exhaustion in production | MEDIUM | Scale up Azure SQL tier for more connections. Reduce `Max Pool Size` per instance. Restart Function App instances. Add connection pool monitoring alerts |
| Resource mailboxes not provisioned | MEDIUM | Run Exchange Online PowerShell to create equipment mailboxes. Update vehicle records with mailbox IDs. Calendar sync starts working after provisioning. No code change needed if the code already handles missing mailbox gracefully |
| SPFx bundle too large for Teams | MEDIUM | Audit dependencies, implement code splitting, lazy-load admin features. Requires code changes and redeployment. Use `webpack-bundle-analyzer` to identify bloat |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tenant-wide API permissions | Phase 1: Infrastructure | Audit SharePoint Online Client Extensibility principal permissions; document each scope and justification |
| Token audience mismatch | Phase 1: Infrastructure | End-to-end SPFx-to-Function call succeeds with a decoded, inspected token |
| Double-booking race condition | Phase 2: Core Booking | Load test with concurrent booking attempts; database constraint rejects overlaps |
| Cannot create resource mailboxes via Graph | Phase 1: Infrastructure | PowerShell provisioning script tested; at least one equipment mailbox created and accessible via Graph |
| No webhook subscriptions on resource mailboxes | Phase 2: Calendar Integration | Polling-based sync mechanism implemented and tested; no reliance on Graph subscriptions |
| CORS + Easy Auth conflict | Phase 1: Infrastructure | SPFx preflight requests succeed against deployed Function App with auth enabled |
| Timezone display errors | Phase 2: Booking UI + Phase 3: Calendar | Booking created in timezone A, viewed from timezone B, displayed correctly in location timezone |
| Cold start latency | Phase 1: Infrastructure | Hosting plan selected (Premium/Flex Consumption); cold start measured and documented as acceptable or mitigated |
| Connection pool exhaustion | Phase 2: API Development | Singleton pool pattern verified; load test against Azure SQL connection limits |
| Client-side role trust | Phase 2: API Development | Penetration test: regular user calls admin endpoints directly; all return 403 |
| SPFx Teams tab differences | Phase 3: Teams Integration | Web part tested in SharePoint page, Teams channel tab, and Teams personal app; all three work correctly |
| Bundle size bloat | Phase 3: Polish/Optimization | Bundle size measured; main chunk under 250KB; lazy loading verified for admin routes |
| Over-broad Graph permissions | Phase 1: Infrastructure | Graph API application restricted to vehicle mailboxes only via Exchange RBAC for Applications |

## Sources

- [Changes on SPFx permission grants in Entra ID - Microsoft 365 Developer Blog](https://devblogs.microsoft.com/microsoft365dev/changes-on-sharepoint-framework-spfx-permission-grants-in-microsoft-entra-id/) -- HIGH confidence
- [Beware of Declarative Permissions - Voitanos](https://www.voitanos.io/blog/consider-avoiding-declarative-permissions-with-azure-ad-services-in-sharepoint-framework-projects/) -- HIGH confidence
- [Secure Azure Function Apps with Entra ID for SPFx - Voitanos](https://www.voitanos.io/blog/securing-an-azure-function-app-with-azure-ad-works-with-with-sharepoint-framework/) -- HIGH confidence
- [Securing Azure Function with Entra ID and calling from SPFx - RLV Blog](https://www.rlvision.com/blog/securing-an-azure-function-with-entra-id-and-calling-it-from-spfx/) -- MEDIUM confidence
- [Connect to Entra ID-secured APIs in SPFx - Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient) -- HIGH confidence
- [Double bookings on room calendar not rejected - GitHub Issue #243](https://github.com/microsoftgraph/msgraph-sdk-dotnet/issues/243) -- HIGH confidence
- [How to prevent double booking in Graph API room calendar - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1220908/how-to-prevent-double-booking-of-events-in-a-micro) -- MEDIUM confidence
- [Manage connections in Azure Functions - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-functions/manage-connections) -- HIGH confidence
- [Azure SQL Connection Pooling Best Practices - GigXP](https://www.gigxp.com/azure-sql-connection-pooling-best-practices/) -- MEDIUM confidence
- [node-mssql Connection Pools and Azure Functions - GitHub Issue #942](https://github.com/tediousjs/node-mssql/issues/942) -- HIGH confidence
- [Cold Starts in Azure Functions - Mikhail Shilkov](https://mikhail.io/serverless/coldstarts/azure/) -- HIGH confidence
- [Azure Functions Premium Plan - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-functions/functions-premium-plan) -- HIGH confidence
- [Building SPFx Teams Tabs - Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) -- HIGH confidence
- [SPFx in Teams tab not rendering - GitHub Issue #9920](https://github.com/SharePoint/sp-dev-docs/issues/9920) -- MEDIUM confidence
- [Handling Double-Booking Problem in Databases - Adam Djellouli](https://adamdjellouli.com/articles/databases_notes/07_concurrency_control/04_double_booking_problem) -- MEDIUM confidence
- [MS Graph API with Resource Calendar - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2261621/ms-graph-api-with-resource-calendar) -- HIGH confidence
- [CORS issue accessing Azure Function from SPFx - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/178011/cors-issue-while-accessing-azure-function-from-spf) -- MEDIUM confidence
- [Restrict Graph API Permissions for Exchange Online - AdminBrainDump](https://adminbraindump.com/post/restrict-graph-api/) -- MEDIUM confidence
- [Tenant-scoped solution deployment for SPFx - Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tenant-scoped-deployment) -- HIGH confidence

---
*Pitfalls research for: M365/Azure Internal Vehicle Rental System (SPFx + Azure Functions + Azure SQL)*
*Researched: 2026-02-22*
