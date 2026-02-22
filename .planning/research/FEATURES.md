# Feature Research

**Domain:** Internal corporate vehicle rental / fleet pool booking (M365/Azure)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **Vehicle browsing with filters** (location, date/time range, category) | Users need to quickly find a vehicle that fits their need at their office. Every pool car system (Smartrak PoolCar, Autofleet, Fleetio) has this front-and-center. | MEDIUM | Requires location-aware filtering, date/time range availability calculation against existing bookings. Must query Azure SQL with overlap detection. |
| T2 | **Vehicle detail view** (make, model, year, plate, category, capacity, photo) | Users need to confirm the vehicle is suitable before booking. Standard in all rental UIs. | LOW | Straightforward read from vehicle table. Photo stored in Azure Blob or SharePoint document library. |
| T3 | **Booking creation** (select vehicle, set start/end date+time, confirm) | The core action. Without this, there is no product. | MEDIUM | Must enforce double-booking prevention at the API layer with optimistic concurrency or row-level locking. Store in UTC, accept in local time. |
| T4 | **Double-booking prevention** | Users expect that if they see a vehicle as available and click book, it is actually available. Conflict = trust destroyed. | HIGH | Race conditions are the hard part. Requires either database-level serializable transactions on the booking overlap check, or a reservation-lock pattern (short TTL hold while user confirms). See PITFALLS.md. |
| T5 | **Booking confirmation notification** (email and/or Teams) | Every booking system sends a confirmation. Users expect immediate feedback that their booking succeeded. | LOW | Send via Graph API: email through `/me/sendMail` or Teams chat message via bot. Can also create Outlook calendar event on user's calendar. |
| T6 | **Return reminder notification** | Users forget return times. Reminders prevent cascading late returns that block the next booking. Standard in all pool car systems. | LOW | Scheduled Azure Function checks upcoming returns (e.g., 1 hour before) and sends reminder via Graph API email/Teams message. |
| T7 | **My bookings view** (upcoming, active, past) | Users need to see their own reservations. Every booking system has this. | LOW | Simple query filtered by current user's Entra ID object ID. Three tabs/filters by status. |
| T8 | **Availability calendar view** | Visual calendar showing when vehicles are booked vs. free. Users strongly prefer visual over list-only. PoolCar, BookingYoyo, and all major competitors offer this. | MEDIUM | Render a timeline/calendar grid per vehicle. Can use a React calendar component (e.g., FullCalendar). Needs efficient query for date-range bookings. |
| T9 | **Authentication via Entra ID SSO** | Internal M365 app -- users expect to be logged in automatically. No separate credentials. | MEDIUM | SPFx handles auth context natively. Azure Functions validate tokens via Entra ID (MSAL). Well-documented pattern but requires correct app registration, scopes, and token validation. |
| T10 | **Role-based access control** (Employee, Manager, Admin) | Different users need different capabilities. Every fleet system (Fleetio, PoolCar, Autofleet) enforces roles. Standard enterprise pattern. | MEDIUM | Map to Entra ID App Roles or Security Groups. Enforce at API layer (Azure Functions middleware). Frontend hides/shows UI based on role claims in token. |
| T11 | **Admin: Vehicle CRUD** (add, edit, remove vehicles) | Fleet admins must manage the inventory. Without this, the system is read-only. | LOW | Standard CRUD API + admin form in SPFx. |
| T12 | **Admin: Vehicle status management** (available, in maintenance, retired) | Admins need to take vehicles offline without deleting them. Every fleet system supports this. | LOW | Status enum on vehicle record. Vehicles not in "available" status excluded from booking search. |
| T13 | **Admin: View all bookings** | Admins need full visibility across locations and users. | LOW | Same booking query without user/location filters. Add admin-only API endpoint with role check. |
| T14 | **Admin: Override/cancel bookings** | Admins must resolve conflicts, handle vehicle breakdowns, etc. | LOW | Soft-cancel with reason. Trigger notification to affected employee. |
| T15 | **Timezone-correct display** | Global company = multiple timezones. Users must see times in their local timezone. Bookings stored in UTC. Confusion over times = missed pickups and conflicts. | MEDIUM | Store all datetimes as UTC in Azure SQL. Convert to user's timezone (from Entra ID profile or browser) on display. All API inputs accept timezone offset or IANA timezone identifier. Every datetime in the UI must show the timezone. |
| T16 | **SPFx webpart in SharePoint and Teams** | The stated deployment target. Users access via their existing M365 surfaces. | MEDIUM | Single SPFx webpart deployed to both SharePoint app catalog and Teams app. Different hosting contexts require testing (Teams SDK vs. SharePoint page context). |

### Differentiators (Competitive Advantage)

Features that set this product apart from generic pool car systems. Not expected, but valuable -- especially because this system lives natively in the M365 ecosystem.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Vehicle resource calendars in Outlook** (Exchange equipment mailboxes via Graph API) | Each vehicle gets an Exchange equipment mailbox. Bookings appear as calendar events. Users can see vehicle availability directly in Outlook without opening the app. **No competitor in the pool car space does this natively.** | HIGH | Create equipment mailboxes per vehicle via Exchange Online PowerShell or Graph API. On booking creation, create a calendar event on the vehicle's resource calendar. Booking cancellation removes the event. Must handle the CalendarProcessing settings (AutoAccept, booking window, max duration). Requires Exchange Online admin consent for equipment mailbox creation. See [Microsoft docs](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes). |
| D2 | **Teams Adaptive Card notifications** | Rich, actionable notifications in Teams -- not just plain text. Booking confirmations, return reminders, and manager alerts as Adaptive Cards with action buttons (e.g., "View Booking", "Cancel"). | MEDIUM | Use Teams Bot Framework or Graph API to send Adaptive Cards. Cards authored in JSON, rendered natively in Teams. Can include approve/decline actions for future approval workflows. See [Microsoft docs](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/sequential-workflows). |
| D3 | **Outlook calendar event on user's personal calendar** | When a user books a vehicle, a calendar event is automatically created on their Outlook calendar with vehicle details, pickup location, and return time. Users get native Outlook reminders. | MEDIUM | Graph API `POST /users/{id}/events` with vehicle details in subject/body/location. Include the vehicle resource mailbox as an attendee to also book the resource calendar (D1). Cancelling the booking removes the event. |
| D4 | **Manager team visibility dashboard** | Managers see their direct reports' current and upcoming bookings in one view. No other pool car system integrates with Entra ID org hierarchy for this. | MEDIUM | Query manager's direct reports via Graph API (`/me/directReports`), then filter bookings by those user IDs. Provides oversight without approval gates. |
| D5 | **Locations synced from Entra ID** | No manual location management. Offices/locations pulled from Entra ID user profiles or organizational data. Single source of truth. | MEDIUM | Sync locations from Entra ID `officeLocation` or custom attributes. Azure Function on a schedule or triggered sync. Eliminates admin overhead of maintaining a separate location list. |
| D6 | **Reporting and analytics dashboard** (utilization rates, bookings per location, most-used vehicles, trends) | Admins can right-size the fleet, identify underused vehicles, and justify budget. PoolCar and Fleetio emphasize this as a premium feature. | HIGH | Aggregate queries on booking data. Pre-compute daily/weekly/monthly utilization per vehicle. Power BI embedded or custom charts in SPFx (Chart.js, Recharts). Export to CSV/Excel. |
| D7 | **Check-in / check-out workflow** | Digital confirmation that the vehicle was actually picked up and returned. Closes the gap between "booked" and "in use". PoolCar and Autofleet both have this. | MEDIUM | Employee clicks "Check Out" at pickup time (optional: capture odometer, condition notes). Clicks "Check In" on return. Status transitions: Reserved -> Checked Out -> Returned. Late check-ins trigger notifications. |
| D8 | **Conflict-aware booking suggestions** | When a user's desired time slot is taken, suggest the nearest available slot or alternative vehicles at the same location. | MEDIUM | Query available vehicles for the same location and similar time window. Present alternatives in the booking UI. Reduces friction from "not available" dead ends. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create complexity disproportionate to their value, or conflict with the product's core value of **fast self-service booking**.

| # | Feature | Why Requested | Why Problematic | Alternative |
|---|---------|---------------|-----------------|-------------|
| A1 | **Approval workflow for every booking** | Managers want control over vehicle usage. | Destroys the core value (speed/self-service). Adds latency, creates bottleneck. Manager visibility (D4) provides oversight without blocking. PoolCar found that removing approval gates increased adoption significantly. | Manager notification on booking (T5) + manager dashboard (D4). Add optional approval only for specific vehicle categories (e.g., executive vehicles) if ever needed -- but not in v1. |
| A2 | **GPS / real-time vehicle tracking** | "We should know where our vehicles are." | Requires hardware (GPS trackers), real-time data ingestion pipeline, map rendering, privacy concerns with tracking employees. Massive scope increase for marginal value in a booking system. | Mark as Out of Scope for v1 (aligns with PROJECT.md). If needed later, integrate with existing telematics (Smartrak, Geotab) rather than building from scratch. |
| A3 | **Automated maintenance scheduling** | "System should schedule oil changes automatically." | Requires mileage tracking, service history, vendor integration, work order management -- this is a full fleet maintenance product (Fleetio, FASTER). Out of scope for a booking system. | Admin manually sets vehicle status to "In Maintenance" (T12). Add a notes field for maintenance details. Revisit only if fleet exceeds 100+ vehicles. |
| A4 | **Payment / cost allocation / billing** | "Departments should be charged for vehicle usage." | Requires cost center integration, billing engine, approval of charges, dispute resolution. Significantly increases complexity. Most internal fleet systems defer this. | Track booking data (who, when, how long) so finance can do cost allocation offline via exported reports (D6). Add cost-center tagging in v2 if validated. |
| A5 | **Mobile native app** | "Employees need a mobile app." | SPFx in Teams already works on mobile (Teams mobile app). Building a separate native app doubles the frontend codebase for minimal incremental value. | Ensure SPFx webpart is responsive and works well in Teams mobile. This covers 95% of mobile use cases with zero additional development. |
| A6 | **Multi-tenant / SaaS deployment** | "Other companies could use this too." | Premature abstraction. Multi-tenancy adds auth complexity, data isolation concerns, deployment pipeline changes. The system is for one organization. | Build single-tenant. If demand emerges, refactor later -- the Azure SQL + Azure Functions architecture can be adapted to multi-tenant without a full rewrite. |
| A7 | **Drag-and-drop calendar booking** | "Users should drag on the calendar to create bookings." | Complex interaction pattern in SPFx (limited DOM control). Accessibility concerns. Mobile unusable. High implementation cost for a "cool" feature that form-based booking handles better. | Calendar view is read-only for visualization (T8). Booking creation via a clear form/dialog (T3). |
| A8 | **Waitlist / queue system** | "If a vehicle is booked, let me join a waitlist." | Adds significant state management (queue ordering, notifications on cancellation, race conditions on queue pop). Rarely triggered in practice for internal fleets. | Show alternative available time slots and vehicles (D8). Users can set a personal reminder to check back. |

## Feature Dependencies

```
[T9: Entra ID Auth]
    |
    +--requires--> [T10: RBAC] --requires--> [T11: Vehicle CRUD (Admin)]
    |                                         [T12: Vehicle Status (Admin)]
    |                                         [T13: View All Bookings (Admin)]
    |                                         [T14: Override Bookings (Admin)]
    |                                         [D4: Manager Dashboard]
    |
    +--requires--> [T1: Vehicle Browsing]
    |                  |
    |                  +--requires--> [T15: Timezone Display]
    |                  +--requires--> [T3: Booking Creation]
    |                                     |
    |                                     +--requires--> [T4: Double-Booking Prevention]
    |                                     +--enables---> [T5: Booking Confirmation]
    |                                     +--enables---> [T6: Return Reminder]
    |                                     +--enables---> [T7: My Bookings]
    |                                     +--enables---> [D1: Vehicle Resource Calendar]
    |                                     +--enables---> [D3: User Calendar Event]
    |                                     +--enables---> [D7: Check-in/Check-out]
    |
    +--requires--> [T8: Availability Calendar] (read-only, depends on booking data)
    |
    +--requires--> [D5: Location Sync from Entra ID] --enhances--> [T1: Vehicle Browsing]

[T16: SPFx Webpart] --hosts--> all frontend features

[D6: Reporting Dashboard] --requires--> [T3: Booking Creation] (needs booking data to report on)
                          --requires--> [D7: Check-in/Check-out] (for actual usage vs. booked time)

[D2: Teams Adaptive Cards] --enhances--> [T5: Booking Confirmation]
                           --enhances--> [T6: Return Reminder]
                           --enhances--> [D4: Manager Notifications]

[D8: Conflict-Aware Suggestions] --enhances--> [T3: Booking Creation]
                                  --requires--> [T4: Double-Booking Prevention]
```

### Dependency Notes

- **T9 (Auth) is the foundation:** Every feature depends on knowing who the user is and what role they have. Must be built first.
- **T10 (RBAC) gates admin and manager features:** No admin CRUD or manager dashboard without role enforcement.
- **T3 (Booking) is the core value chain:** Most features either feed into booking creation or consume booking data. The booking flow and double-booking prevention must be rock-solid before layering on notifications, calendars, and reporting.
- **D1 (Resource Calendars) and D3 (User Calendar Events) are Graph API-heavy:** Both depend on correct Exchange Online configuration and Graph API permissions. Can be built in parallel but require admin consent for mailbox operations.
- **D5 (Location Sync) enhances T1 (Browsing):** Browsing works with manually managed locations, but location sync eliminates admin overhead. Can be phased.
- **D6 (Reporting) needs booking history:** Only valuable after the system has been in use. Build the reporting infrastructure but defer complex dashboards until there is real data.
- **D7 (Check-in/Check-out) enhances D6 (Reporting):** Actual usage data (vs. booked time) makes utilization reports accurate. Without check-in/check-out, utilization is estimated from booking duration.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed for employees to actually use this instead of emailing the fleet admin.

- [x] **T9: Entra ID Authentication** -- No app without auth
- [x] **T10: Role-Based Access Control** -- Employee/Manager/Admin separation from day one
- [x] **T16: SPFx Webpart** -- The delivery vehicle (pun intended); must work in SharePoint and Teams
- [x] **T1: Vehicle Browsing with Filters** -- Users must find available vehicles
- [x] **T2: Vehicle Detail View** -- Users must confirm the vehicle is suitable
- [x] **T3: Booking Creation** -- The core action
- [x] **T4: Double-Booking Prevention** -- Without this, trust is immediately broken
- [x] **T15: Timezone-Correct Display** -- Global company; wrong times = unusable
- [x] **T5: Booking Confirmation** (email) -- Users need confirmation
- [x] **T7: My Bookings View** -- Users need to see their reservations
- [x] **T11: Vehicle CRUD (Admin)** -- Admin must manage fleet inventory
- [x] **T12: Vehicle Status (Admin)** -- Admin must take vehicles offline
- [x] **T13: View All Bookings (Admin)** -- Admin needs full visibility
- [x] **T14: Cancel/Override Bookings (Admin)** -- Admin must resolve issues

### Add After Validation (v1.x)

Features to add once core booking is working and adopted.

- [ ] **T8: Availability Calendar View** -- High-value visual but not blocking for launch if list view works
- [ ] **T6: Return Reminders** -- Scheduled job; add once booking flow is stable
- [ ] **D1: Vehicle Resource Calendars (Outlook)** -- The biggest differentiator; add once Exchange equipment mailbox pattern is validated
- [ ] **D3: User Calendar Events** -- Pairs with D1; natural next step after resource calendars work
- [ ] **D2: Teams Adaptive Card Notifications** -- Upgrade from plain email to rich cards
- [ ] **D5: Location Sync from Entra ID** -- Automate location management
- [ ] **D7: Check-in/Check-out Workflow** -- Track actual vehicle usage

### Future Consideration (v2+)

Features to defer until product is established and real usage data exists.

- [ ] **D4: Manager Team Dashboard** -- Needs org hierarchy integration; managers can use admin view with filtered scope initially
- [ ] **D6: Reporting/Analytics Dashboard** -- Needs historical data to be meaningful; export to Excel covers early needs
- [ ] **D8: Conflict-Aware Booking Suggestions** -- Nice UX polish; only matters at scale when conflicts are frequent

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| T9: Entra ID Auth | HIGH | MEDIUM | P1 |
| T10: RBAC | HIGH | MEDIUM | P1 |
| T16: SPFx Webpart | HIGH | MEDIUM | P1 |
| T1: Vehicle Browsing | HIGH | MEDIUM | P1 |
| T2: Vehicle Details | HIGH | LOW | P1 |
| T3: Booking Creation | HIGH | MEDIUM | P1 |
| T4: Double-Booking Prevention | HIGH | HIGH | P1 |
| T15: Timezone Display | HIGH | MEDIUM | P1 |
| T5: Booking Confirmation | HIGH | LOW | P1 |
| T7: My Bookings | HIGH | LOW | P1 |
| T11: Vehicle CRUD | HIGH | LOW | P1 |
| T12: Vehicle Status | MEDIUM | LOW | P1 |
| T13: All Bookings (Admin) | MEDIUM | LOW | P1 |
| T14: Cancel Bookings (Admin) | MEDIUM | LOW | P1 |
| T8: Availability Calendar | HIGH | MEDIUM | P2 |
| T6: Return Reminders | MEDIUM | LOW | P2 |
| D1: Vehicle Resource Calendars | HIGH | HIGH | P2 |
| D3: User Calendar Events | HIGH | MEDIUM | P2 |
| D2: Teams Adaptive Cards | MEDIUM | MEDIUM | P2 |
| D5: Location Sync | MEDIUM | MEDIUM | P2 |
| D7: Check-in/Check-out | MEDIUM | MEDIUM | P2 |
| D4: Manager Dashboard | MEDIUM | MEDIUM | P3 |
| D6: Reporting Dashboard | HIGH | HIGH | P3 |
| D8: Booking Suggestions | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add in v1.x
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Smartrak PoolCar | Autofleet Motor Pool | MS Bookings | Our Approach |
|---------|-----------------|---------------------|-------------|--------------|
| Self-service booking | Yes, web + mobile | Yes, web + mobile | Yes, web | SPFx in SharePoint + Teams (web + Teams mobile) |
| Calendar view | Yes, drag-to-book | Yes, timeline | Limited | Read-only calendar (T8) + form-based booking (T3) |
| Check-in/check-out | Yes, with inspection forms | Yes, with damage capture | No | Simple check-in/out (D7) without inspection forms in v1 |
| Resource calendar (Outlook) | No | No | Yes (Bookings calendars) | Exchange equipment mailbox per vehicle (D1) -- unique advantage |
| Teams integration | No | No | Partial | Native SPFx Teams tab + Adaptive Card notifications (D2) |
| Role-based access | Yes (admin, manager, user) | Yes (admin, dispatcher, driver) | Limited (admin, staff) | Entra ID App Roles (T10) -- three tiers |
| Reporting | Yes, utilization + FBT | Yes, fleet analytics | Basic | Custom dashboard (D6) with export |
| Multi-location + timezone | Yes | Yes | Yes (per business) | Entra ID location sync (D5) + UTC storage with local display (T15) |
| Double-booking prevention | Yes | Yes | Yes | Database-level enforcement (T4) |
| Notifications | Email | Email + in-app | Email + SMS | Email + Teams Adaptive Cards (D2) -- M365 native |
| Key management | Yes (KeyMaster, keyless) | Yes (key box, keyless) | No | Not in v1 (physical key processes outside system) |
| GPS tracking | Yes (telematics) | Yes (real-time) | No | Not in scope (A2) |
| Cost allocation | Yes (cost centres, FBT) | Partial | No | Not in v1; export data for offline allocation (A4) |

## Sources

- [Microsoft Learn: Manage resource mailboxes in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes) -- HIGH confidence (official docs, updated 2025)
- [Microsoft Learn: Outlook Calendar API overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) -- HIGH confidence
- [Microsoft Learn: Microsoft Bookings API overview](https://learn.microsoft.com/en-us/graph/booking-concept-overview) -- HIGH confidence
- [Microsoft Learn: Adaptive Cards for Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/sequential-workflows) -- HIGH confidence
- [Microsoft Learn: Exchange equipment mailboxes](https://learn.microsoft.com/en-us/exchange/recipients/equipment-mailboxes) -- HIGH confidence
- [Smartrak PoolCar](https://smartrak.com/poolcar/) -- MEDIUM confidence (vendor marketing, cross-referenced with reviews)
- [Autofleet Motor Pool Management](https://autofleet.io/motor-pool-management-and-corporate-car-sharing) -- MEDIUM confidence (vendor marketing)
- [Fleetio Roles & Permissions](https://www.fleetio.com/features/user-management) -- MEDIUM confidence (vendor docs)
- [Room Manager Fleet Management for Office 365](https://roommanager.com/fleet-management-solution/) -- MEDIUM confidence
- [Twice Commerce: Real-time rental availability](https://www.twicecommerce.com/blog/real-time-rental-availability-avoid-double-bookings) -- MEDIUM confidence (industry patterns)
- [Fleet Management Dashboard: Features, Metrics, and Tips (PCS Software)](https://pcssoft.com/blog/fleet-management-dashboard/) -- MEDIUM confidence
- [Carpanion Fleet](https://www.carpanion-fleet.com/en/) -- MEDIUM confidence (vendor marketing)

---
*Feature research for: Internal corporate vehicle rental / fleet pool booking (M365/Azure)*
*Researched: 2026-02-22*
