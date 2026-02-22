# RentAVehicle — Internal Fleet Rental System

## What This Is

An internal vehicle rental application for M365/Azure that lets employees self-service book vehicles from the company's global fleet. Employees browse available vehicles at their location, pick a specific car or van, and book it with hourly precision. Managers have visibility into their team's rentals and receive notifications. Fleet admins manage vehicles, statuses, bookings, and reporting through a backoffice interface. The solution runs as an SPFx webpart in both SharePoint and Microsoft Teams.

## Core Value

Employees can quickly find and book an available vehicle at their location for client visits or transport — self-service, no approval bottleneck.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Employee can browse available vehicles filtered by location, date/time range, and category
- [ ] Employee can view vehicle details (make, model, year, plate, category, capacity, photo)
- [ ] Employee can book a specific vehicle with start date/time and return date/time
- [ ] Employee receives booking confirmation via email/Teams
- [ ] Employee receives return reminder before return date/time
- [ ] Employee can check in (return) a vehicle through the system
- [ ] Employee can view their own rental history (past, active, upcoming)
- [ ] Vehicle availability shown as both filterable list and calendar view
- [ ] Each vehicle has an Outlook resource calendar showing its bookings (Graph API)
- [ ] Manager can see their team's current and upcoming rentals
- [ ] Manager receives notifications when an employee books a vehicle
- [ ] Admin can add, edit, and remove vehicles from the fleet (CRUD)
- [ ] Admin can set vehicle status (available, in maintenance, retired, etc.)
- [ ] Admin can view all bookings across all locations
- [ ] Admin can override/cancel employee bookings
- [ ] Admin has full reporting: utilization rates, most-used vehicles, bookings per location, exportable reports, dashboards, trends over time
- [ ] Locations synced from Entra ID / company directory
- [ ] Time zones handled per location (bookings stored in UTC, displayed in local time)
- [ ] Authentication via Microsoft Entra ID (SSO for all M365 users)
- [ ] Role-based access: Employee, Manager, Admin — enforced via Entra ID groups/app roles
- [ ] SPFx webpart works in both SharePoint pages and Teams tabs

### Out of Scope

- Mobile native app — web-first via SPFx in SharePoint/Teams
- External user access — internal employees only
- Vehicle GPS tracking — not needed for v1
- Payment/billing — internal fleet, no cost allocation for v1
- Maintenance scheduling — admin marks status manually, no automated maintenance workflows
- Multi-tenant — single organization deployment

## Context

- **Origin**: SharePoint Senior Developer case study turned into a real full-stack implementation
- **Stack direction**: User has strong preference for Azure SQL, Azure Functions, SPFx, Entra ID, Graph API — research should validate this stack and explore alternatives, but default to these choices if they hold up
- **Global company**: Multiple locations worldwide means timezone handling is a first-class concern
- **Graph API use case**: Vehicle resource calendars in Exchange — each vehicle gets calendar entries for its bookings, providing visibility in Outlook
- **Notifications**: Leveraging M365 ecosystem — Teams messages, Outlook emails, calendar events
- **Locations from Entra ID**: Company locations/offices already exist in the directory; sync rather than duplicate

## Constraints

- **Platform**: Must run within M365/Azure ecosystem — SharePoint, Teams, Azure services
- **Auth**: Microsoft Entra ID only — no external identity providers
- **Hosting**: Azure Functions for API, Azure SQL for data, SPFx for frontend
- **Users**: Internal employees only — no external/guest access
- **Deployment**: Single-tenant, single organization

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SPFx for frontend (not Power Apps) | Full control, works in both SharePoint and Teams, developer-grade customization | — Pending (validate in research) |
| Azure SQL for data (not SharePoint Lists) | Relational data, complex queries for reporting, better performance at scale | — Pending (validate in research) |
| Azure Functions for API | Serverless, cost-effective, integrates with Entra ID and Graph API | — Pending (validate in research) |
| Self-service (no approval flow) | Speed of booking is core value, manager has visibility but no gate | — Pending |
| Vehicle resource calendars via Graph API | Native Outlook visibility, leverages existing M365 infrastructure | — Pending (validate in research) |
| Locations synced from Entra ID | Single source of truth, no manual location management | — Pending (validate in research) |

---
*Last updated: 2026-02-22 after initialization*
