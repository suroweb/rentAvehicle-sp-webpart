# RentAVehicle — Internal Fleet Rental System

## What This Is

An internal vehicle rental application for M365/Azure that lets employees self-service book vehicles from the company's global fleet. Employees browse available vehicles at their location, pick a specific car or van, and book it with hourly precision through a polished booking experience with navigable availability strips and unified date range pickers. Managers have visibility into their team's rentals and receive notifications. Fleet admins manage vehicles, statuses, bookings, and reporting through a backoffice interface. The solution runs as an SPFx webpart in both SharePoint and Microsoft Teams, with Exchange resource calendars, email/Teams notifications, and scheduled reminders.

## Core Value

Employees can quickly find and book an available vehicle at their location for client visits or transport — self-service, no approval bottleneck.

## Requirements

### Validated

- ✓ Employee can browse available vehicles filtered by location, date/time range, and category — v1.0
- ✓ Employee can view vehicle details (make, model, year, plate, category, capacity, photo) — v1.0
- ✓ Employee can book a specific vehicle with start date/time and return date/time — v1.0
- ✓ Employee receives booking confirmation via email/Teams — v1.0
- ✓ Employee receives return reminder before return date/time — v1.0
- ✓ Employee can check in (return) a vehicle through the system — v1.0
- ✓ Employee can view their own rental history (past, active, upcoming) — v1.0
- ✓ Vehicle availability shown as both filterable list and calendar view — v1.0
- ✓ Each vehicle has an Outlook resource calendar showing its bookings (Graph API) — v1.0
- ✓ Manager can see their team's current and upcoming rentals — v1.0
- ✓ Manager receives notifications when an employee books a vehicle — v1.0
- ✓ Admin can add, edit, and remove vehicles from the fleet (CRUD) — v1.0
- ✓ Admin can set vehicle status (available, in maintenance, retired, etc.) — v1.0
- ✓ Admin can view all bookings across all locations — v1.0
- ✓ Admin can override/cancel employee bookings — v1.0
- ✓ Admin has full reporting: utilization rates, most-used vehicles, bookings per location, exportable reports, dashboards, trends over time — v1.0
- ✓ Locations synced from Entra ID / company directory — v1.0
- ✓ Time zones handled per location (bookings stored in UTC, displayed in local time) — v1.0
- ✓ Authentication via Microsoft Entra ID (SSO for all M365 users) — v1.0
- ✓ Role-based access: Employee, Manager, Admin — enforced via Entra ID groups/app roles — v1.0
- ✓ SPFx webpart works in both SharePoint pages and Teams tabs — v1.0

### Active

#### Current Milestone: v1.1 Production & Documentation

**Goal:** Make v1.0 deployable, verifiable, and presentable — verify live tenant integrations, create deployment and developer documentation, set up CI/CD and IaC, and add admin timezone configuration.

**Target features:**
- Live tenant verification of M365 calendar integration and notifications
- App registration and Graph API setup guide
- SharePoint App Catalog deployment guide
- Developer documentation and portfolio README
- CI/CD pipeline with GitHub Actions
- Infrastructure as Code with Bicep templates
- Admin timezone configuration per location

### Out of Scope

- Mobile native app — web-first via SPFx in SharePoint/Teams, PWA works well
- External user access — internal employees only
- Vehicle GPS tracking — not needed, location-based model sufficient
- Payment/billing — internal fleet, no cost allocation for v1 (v2 COST-01/02 deferred)
- Maintenance scheduling — admin marks status manually, no automated maintenance workflows
- Multi-tenant — single organization deployment
- Approval workflow for bookings — self-service speed is core value, manager visibility provides oversight without blocking
- Key management (physical/digital) — physical key processes handled offline

## Context

Shipped v1.0 MVP with 17,175 LOC TypeScript/SCSS across 254 files in 4 days.
Tech stack: SPFx 1.22 (React 17.0.1, Fluent UI v8), Azure Functions v4 (Node.js 22), Azure SQL, Graph API.
10 phases executed (30 plans total), including 3 inserted decimal phases for UX polish and cleanup.
Initial UX testing led to range picker unification (Phase 08.1) and Day View removal (Phase 08.1.1).

## Constraints

- **Platform**: Must run within M365/Azure ecosystem — SharePoint, Teams, Azure services
- **Auth**: Microsoft Entra ID only — no external identity providers
- **Hosting**: Azure Functions for API, Azure SQL for data, SPFx for frontend
- **Users**: Internal employees only — no external/guest access
- **Deployment**: Single-tenant, single organization
- **SPFx runtime**: React 17.0.1 exact pin (React 18 breaks SPFx 1.22), Fluent UI v8 only (v9 has rendering issues)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SPFx for frontend (not Power Apps) | Full control, works in both SharePoint and Teams, developer-grade customization | ✓ Good — seamless SP/Teams dual rendering |
| Azure SQL for data (not SharePoint Lists) | Relational data, complex queries for reporting, better performance at scale | ✓ Good — SERIALIZABLE transactions, SQL aggregation reporting |
| Azure Functions for API | Serverless, cost-effective, integrates with Entra ID and Graph API | ✓ Good — v4 Node.js 22 stable, Easy Auth SSO |
| Self-service (no approval flow) | Speed of booking is core value, manager has visibility but no gate | ✓ Good — core value preserved |
| Vehicle resource calendars via Graph API | Native Outlook visibility, leverages existing M365 infrastructure | ✓ Good — fire-and-forget pattern, never blocks bookings |
| Locations synced from Entra ID | Single source of truth, no manual location management | ✓ Good — Graph API officeLocation sync |
| Teams activity feed (not Adaptive Cards) | No bot registration needed, deep links to app | ✓ Good — simpler than bot-based approach |
| Fire-and-forget for calendar/notifications | Calendar/notification failures never block booking operations | ✓ Good — resilient booking flow |
| Base64 photo storage (not Blob Storage) | Simpler for v1, deferred Azure Blob with Valet Key to v2 | ⚠️ Revisit — large photos increase DB payload |
| Lazy expiration (not timer-based) | Auto-cancel/overdue detection on access, no background timer needed | ✓ Good — simplifies architecture |
| Week View only (Day View removed) | Day View added complexity without sufficient value over per-vehicle week strip | ✓ Good — Phase 08.1.1 cleanup |

---
*Last updated: 2026-02-25 after v1.1 milestone start*
