# Phase 5: M365 Calendar Integration - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Vehicle bookings are natively visible in Outlook. Each vehicle has an Exchange equipment mailbox with a resource calendar showing its schedule. Employees see their rentals on their personal Outlook calendar. The app remains the single system of record for all booking operations — calendars are a read-only projection.

</domain>

<decisions>
## Implementation Decisions

### Calendar event content
- **Vehicle resource calendar title**: Full context format — `Dan Comilosevici - Toyota Camry (ABC-123)`
- **Vehicle resource calendar body**: Booking essentials (employee name, email, department, booking ID, pickup/return times) plus vehicle details (make/model/plate/location/category)
- **Employee personal calendar title**: Employee-focused — `Vehicle Rental: Toyota Camry (ABC-123)`
- **Employee personal calendar body**: Pickup-focused — vehicle details (make/model/plate), pickup location, return time, and a deep link back to the booking in the app
- **Location field**: Set to the vehicle's office location (e.g. 'Bucharest Office')
- **Employee event show-as**: Marked as **Free** — does not affect Teams presence or Outlook availability

### Sync lifecycle
- **Timing**: Real-time — calendar events created/updated immediately when booking actions happen
- **Booking creation**: Creates events on both vehicle resource calendar and employee personal calendar
- **Cancellation**: Updates both events to show 'CANCELLED' in title/body (events are NOT deleted — audit trail preserved)
- **Check-out**: Updates both events to reflect 'IN USE' status
- **Check-in/return**: Updates both events to reflect 'RETURNED' status
- **Time modification**: Calendar event start/end times updated to match booking changes
- **Admin override/cancel**: Same cancellation behavior — both events updated

### Resource calendar visibility
- **Access**: All employees can view vehicle resource calendars in Outlook with full details
- **Organization**: Resource calendars grouped by office location in Outlook (e.g. 'Bucharest Vehicles', 'Cluj Vehicles')
- **Provisioning**: Auto-provision Exchange equipment mailbox when admin adds a new vehicle in the app
- **Backfill**: On Phase 5 deployment, create resource mailboxes for all existing vehicles and sync their active bookings to calendar events
- **Direct booking prevention**: Resource mailboxes configured to auto-decline meeting requests NOT sent by the app's service account — app is the only way to book

### Employee calendar experience
- **Event duration**: Spans full booking period (pickup to return)
- **Reminder**: 30-minute Outlook reminder before pickup time
- **Status updates**: All status changes (check-out, return, cancellation) reflected on the employee's personal calendar event
- **Deep link**: Event body includes a link back to the booking in the app

### Claude's Discretion
- Exchange resource mailbox naming convention and display name format
- Exact HTML/text formatting of event bodies
- Error handling when Graph API calls fail during sync
- Calendar category/color coding approach
- How to handle the backfill migration (batch size, rate limiting)

</decisions>

<specifics>
## Specific Ideas

- Employee's personal calendar event must show as **Free** to avoid messing up Teams status (busy/away/etc.) — a vehicle rental should not block someone's calendar
- The app is the system of record — Outlook calendars are a read-only projection. Direct booking via Outlook invites to the vehicle mailbox must be blocked.
- Vehicle resource calendars should be browsable by all employees for transparency (e.g. "is that car available next week?")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-m365-calendar-integration*
*Context gathered: 2026-02-25*
