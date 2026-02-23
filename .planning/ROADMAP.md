# Roadmap: RentAVehicle

## Overview

RentAVehicle delivers an internal vehicle rental system on Microsoft 365 and Azure in seven phases. Phase 1 establishes the authenticated SPFx-to-Azure-Functions foundation with role-based access. Phase 2 gives admins vehicle fleet management and syncs locations from Entra ID. Phase 3 delivers the core value -- employees booking vehicles at their location with timezone-correct, double-booking-safe reservations. Phase 4 completes the booking lifecycle (calendar views, check-in/out, suggestions, admin oversight). Phases 5-7 layer on the M365-native differentiators: Exchange resource calendars, Teams/email notifications, and reporting dashboards with manager visibility.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Authentication** - Authenticated SPFx webpart in SharePoint and Teams with Entra ID SSO and role-based access
- [x] **Phase 2: Vehicle Inventory and Locations** - Admin fleet management and location sync from Entra ID (completed 2026-02-23)
- [x] **Phase 3: Core Booking Flow** - Employees can find, book, and view vehicle reservations (completed 2026-02-23)
- [ ] **Phase 4: Booking Lifecycle and Admin Oversight** - Full reservation lifecycle with calendar views, check-in/out, and admin control
- [ ] **Phase 5: M365 Calendar Integration** - Vehicle bookings visible in Outlook through resource calendars and employee calendars
- [ ] **Phase 6: Notifications** - Booking confirmations, return reminders, and manager alerts via email and Teams
- [ ] **Phase 7: Reporting and Manager Visibility** - Utilization dashboards, trend analysis, exports, and manager team view

## Phase Details

### Phase 1: Foundation and Authentication
**Goal**: Users can access the RentAVehicle application in both SharePoint and Teams, authenticated via Entra ID SSO with their role (Employee, Manager, Admin) automatically determined
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. User opens the webpart in a SharePoint page and is automatically signed in with their M365 identity -- no separate login
  2. User opens the same webpart as a Teams tab and is automatically signed in
  3. User's role (Employee, Manager, or Admin) is displayed in the UI based on their Entra ID app role assignment
  4. An employee-role user who attempts to call an admin API endpoint receives a 403 Forbidden response
  5. The webpart renders responsively on Teams mobile
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold SPFx + Azure Functions projects, implement auth middleware and API endpoints
- [x] 01-02-PLAN.md — Build SPFx app shell with AuthContext, sidebar, bottom tab bar, welcome screen, error handling
- [x] 01-03-PLAN.md — Integration verification and human-verify checkpoint

### Phase 2: Vehicle Inventory and Locations
**Goal**: Fleet admins can manage the complete vehicle inventory and company locations are automatically synced from the corporate directory
**Depends on**: Phase 1
**Requirements**: VHCL-01, VHCL-02, VHCL-03, VHCL-04, VHCL-05, M365-04
**Success Criteria** (what must be TRUE):
  1. Admin can add a new vehicle with all details (make, model, year, plate, location, category, capacity, photo) and it appears in the fleet list
  2. Admin can edit any vehicle's details and the changes are reflected immediately
  3. Admin can remove a vehicle from the fleet
  4. Admin can change a vehicle's status to "in maintenance" or "retired" and that vehicle no longer appears when employees browse available vehicles
  5. Company office locations from the Entra ID directory are available as selectable locations in the system without manual entry
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Database foundation, models, zod schemas, SuperAdmin role update
- [ ] 02-02-PLAN.md — Vehicle/category/location API endpoints and Graph API location sync
- [ ] 02-03-PLAN.md — Fleet management table UI with filtering, sorting, status badges, row actions
- [ ] 02-04-PLAN.md — Vehicle form, photo upload, category management, location list, human verification

### Phase 3: Core Booking Flow
**Goal**: Employees can find an available vehicle at their location and book it with hourly precision, with the system preventing double-bookings and displaying all times correctly for the vehicle's timezone
**Depends on**: Phase 2
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05, BOOK-06
**Success Criteria** (what must be TRUE):
  1. Employee can filter available vehicles by location, date/time range, and category and see only vehicles that are genuinely available for that slot
  2. Employee can view a vehicle's full details (make, model, year, plate, category, capacity, photo) before booking
  3. Employee can book a vehicle with specific start and return date/times (hourly precision) and the booking is confirmed
  4. When two employees attempt to book the same vehicle for overlapping times simultaneously, one succeeds and the other is prevented -- no double-bookings occur
  5. Employee can view their own bookings organized as upcoming, active, and past
  6. All date/times are displayed in the vehicle's location timezone regardless of where the employee is browsing from
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Backend: DB schema (Bookings table + Locations.timezone), booking model/Zod, booking service with SERIALIZABLE transactions, employee-facing API endpoints
- [ ] 03-02-PLAN.md -- Frontend: Vehicle browse card grid with filters, vehicle detail page with availability strip, inline booking form with timezone display
- [ ] 03-03-PLAN.md -- Frontend: My Bookings page with tabs and cancel flow, AppShell routing integration, human verification checkpoint

### Phase 4: Booking Lifecycle and Admin Oversight
**Goal**: The booking experience is complete -- employees see visual availability, manage the full pickup-to-return lifecycle, get smart suggestions when slots are taken, and admins have full visibility and control over all bookings
**Depends on**: Phase 3
**Requirements**: BOOK-07, BOOK-08, BOOK-09, BOOK-10, ADMN-01, ADMN-02
**Success Criteria** (what must be TRUE):
  1. Employee can view vehicle availability as a visual calendar timeline in addition to the filterable list
  2. Employee can check out a vehicle at pickup time, transitioning its status from reserved to in-use
  3. Employee can check in (return) a vehicle through the system, completing the rental lifecycle
  4. When an employee's desired time slot is taken, the system suggests the nearest available slot or alternative vehicles at the same location
  5. Admin can view all bookings across all locations and all employees in a single view
  6. Admin can cancel or override an employee's booking, and the affected employee is notified
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: M365 Calendar Integration
**Goal**: Vehicle bookings are natively visible in Outlook -- each vehicle has a resource calendar showing its schedule, and employees see their rentals on their personal Outlook calendar
**Depends on**: Phase 3
**Requirements**: M365-01, M365-02, M365-03
**Success Criteria** (what must be TRUE):
  1. Each vehicle in the fleet has a corresponding Exchange equipment mailbox with a resource calendar viewable in Outlook
  2. When an employee books a vehicle, a calendar event appears on that vehicle's resource calendar showing who booked it and when
  3. When an employee books a vehicle, a calendar event appears on the employee's personal Outlook calendar with the vehicle and pickup details
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Notifications
**Goal**: Users receive timely, actionable notifications about booking events through M365 channels -- email confirmations, return reminders, and manager awareness
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. Employee receives a booking confirmation email after making a reservation
  2. Employee receives a return reminder before their return date/time
  3. Manager receives a notification when one of their direct reports books a vehicle
  4. Notifications are delivered as Teams Adaptive Cards with action buttons (not just plain text emails)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Reporting and Manager Visibility
**Goal**: Fleet admins can analyze utilization patterns and export data, and managers can see their team's rental activity
**Depends on**: Phase 4
**Requirements**: RPRT-01, RPRT-02, RPRT-03, RPRT-04
**Success Criteria** (what must be TRUE):
  1. Admin dashboard shows utilization rates per vehicle and per location
  2. Admin dashboard shows booking trends over time (daily, weekly, monthly)
  3. Admin can export report data to CSV or Excel
  4. Manager can view their direct reports' current and upcoming bookings in a team view
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
Note: Phases 5 and 6 depend on Phase 3 (not Phase 4) and can run in parallel with Phase 4 if desired.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Authentication | 3/3 | Complete    | 2026-02-23 |
| 2. Vehicle Inventory and Locations | 0/4 | Complete    | 2026-02-23 |
| 3. Core Booking Flow | 3/3 | Complete | 2026-02-23 |
| 4. Booking Lifecycle and Admin Oversight | 0/TBD | Not started | - |
| 5. M365 Calendar Integration | 0/TBD | Not started | - |
| 6. Notifications | 0/TBD | Not started | - |
| 7. Reporting and Manager Visibility | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-22*
*Last updated: 2026-02-23 (Phase 3 complete)*
