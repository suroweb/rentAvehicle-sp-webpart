# Requirements: RentAVehicle

**Defined:** 2026-02-22
**Core Value:** Employees can quickly find and book an available vehicle at their location for client visits or transport — self-service, no approval bottleneck.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User is authenticated via Microsoft Entra ID SSO — no separate login
- [x] **AUTH-02**: User role (Employee, Manager, Admin) determined from Entra ID App Roles
- [x] **AUTH-03**: API endpoints enforce role-based access — employees cannot access admin functions

### Vehicle Management

- [x] **VHCL-01**: Admin can add a new vehicle (make, model, year, license plate, location, category, capacity, photo)
- [x] **VHCL-02**: Admin can edit vehicle details
- [x] **VHCL-03**: Admin can remove a vehicle from the fleet
- [x] **VHCL-04**: Admin can set vehicle status (available, in maintenance, retired)
- [x] **VHCL-05**: Vehicles not in "available" status are excluded from employee browsing

### Booking

- [x] **BOOK-01**: Employee can browse available vehicles filtered by location, date/time range, and category
- [x] **BOOK-02**: Employee can view vehicle details (make, model, year, plate, category, capacity, photo)
- [x] **BOOK-03**: Employee can book a specific vehicle with start date/time and return date/time (hourly precision)
- [x] **BOOK-04**: System prevents double-booking via database-level constraints
- [x] **BOOK-05**: Employee can view their bookings (upcoming, active, past)
- [x] **BOOK-06**: All times displayed in user's local timezone (stored as UTC)
- [ ] **BOOK-07**: Availability shown as both filterable list and visual calendar timeline
- [ ] **BOOK-08**: Employee can check out a vehicle at pickup time
- [ ] **BOOK-09**: Employee can check in (return) a vehicle through the system
- [ ] **BOOK-10**: When desired slot is taken, system suggests nearest available slot or alternative vehicles

### Admin Operations

- [ ] **ADMN-01**: Admin can view all bookings across all locations
- [ ] **ADMN-02**: Admin can cancel/override employee bookings (with notification to affected employee)

### Notifications

- [ ] **NOTF-01**: Employee receives booking confirmation email via Graph API
- [ ] **NOTF-02**: Employee receives return reminder before return date/time (scheduled Azure Function)
- [ ] **NOTF-03**: Manager receives notification when their employee books a vehicle
- [ ] **NOTF-04**: Notifications delivered as Teams Adaptive Cards with action buttons

### M365 Integration

- [ ] **M365-01**: Each vehicle has an Exchange equipment mailbox with a resource calendar
- [ ] **M365-02**: Booking creates a calendar event on the vehicle's resource calendar (visible in Outlook)
- [ ] **M365-03**: Booking creates a calendar event on the employee's personal Outlook calendar
- [x] **M365-04**: Locations synced from Entra ID (officeLocation or organizational data)

### Reporting

- [ ] **RPRT-01**: Admin dashboard shows utilization rates per vehicle and location
- [ ] **RPRT-02**: Admin dashboard shows booking trends over time
- [ ] **RPRT-03**: Admin can export reports to CSV/Excel
- [ ] **RPRT-04**: Manager can view their direct reports' current and upcoming bookings

### Platform

- [x] **PLAT-01**: SPFx webpart works in SharePoint pages
- [x] **PLAT-02**: SPFx webpart works as a Teams tab
- [x] **PLAT-03**: UI is responsive for Teams mobile

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Booking Enhancements

- **BOOK-V2-01**: Waitlist/queue when desired vehicle is fully booked
- **BOOK-V2-02**: Drag-and-drop calendar booking (create booking by dragging on timeline)

### Cost Management

- **COST-01**: Cost center tagging per booking for departmental allocation
- **COST-02**: Finance export with cost center breakdown

### Moderation

- **MODR-01**: Damage reporting on check-in (photo + notes)
- **MODR-02**: Vehicle condition history log

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Approval workflow for bookings | Destroys core value (self-service speed). Manager visibility provides oversight without blocking. |
| GPS / real-time vehicle tracking | Requires hardware, real-time pipeline, privacy concerns. Massive scope for marginal value. |
| Automated maintenance scheduling | Full fleet maintenance product (Fleetio-level). Admin manually sets status. |
| Payment / billing / cost allocation | Requires billing engine, cost center integration. Track data for offline allocation. |
| Native mobile app | SPFx in Teams mobile covers 95% of mobile use cases. |
| Multi-tenant / SaaS deployment | Single organization. Premature abstraction. |
| Key management (physical/digital) | Outside system scope — physical key processes handled offline. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| VHCL-01 | Phase 2 | Complete |
| VHCL-02 | Phase 2 | Complete |
| VHCL-03 | Phase 2 | Complete |
| VHCL-04 | Phase 2 | Complete |
| VHCL-05 | Phase 2 | Complete |
| BOOK-01 | Phase 3 | Complete |
| BOOK-02 | Phase 3 | Complete |
| BOOK-03 | Phase 3 | Complete |
| BOOK-04 | Phase 3 | Complete |
| BOOK-05 | Phase 3 | Complete |
| BOOK-06 | Phase 3 | Complete |
| BOOK-07 | Phase 4 | Pending |
| BOOK-08 | Phase 4 | Pending |
| BOOK-09 | Phase 4 | Pending |
| BOOK-10 | Phase 4 | Pending |
| ADMN-01 | Phase 4 | Pending |
| ADMN-02 | Phase 4 | Pending |
| NOTF-01 | Phase 6 | Pending |
| NOTF-02 | Phase 6 | Pending |
| NOTF-03 | Phase 6 | Pending |
| NOTF-04 | Phase 6 | Pending |
| M365-01 | Phase 5 | Pending |
| M365-02 | Phase 5 | Pending |
| M365-03 | Phase 5 | Pending |
| M365-04 | Phase 2 | Complete |
| RPRT-01 | Phase 7 | Pending |
| RPRT-02 | Phase 7 | Pending |
| RPRT-03 | Phase 7 | Pending |
| RPRT-04 | Phase 7 | Pending |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
