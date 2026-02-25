# Phase 4: Booking Lifecycle and Admin Oversight - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the booking experience with visual availability, full pickup-to-return lifecycle, smart slot suggestions, and admin oversight. Employees see a calendar timeline, check out and return vehicles through the system, and get alternatives when slots are taken. Admins can view and cancel any booking. Notifications (email/Teams) are Phase 6 — this phase uses in-app status only.

</domain>

<decisions>
## Implementation Decisions

### Calendar timeline design
- Day view with hourly slots — one row per vehicle at the selected location
- Location filter determines which vehicles appear (all vehicles at that location)
- Color-coded blocks spanning booked hours, showing booker's name on the block
- Different colors for own bookings vs others' bookings
- Clicking a free slot opens the booking form pre-filled with vehicle, date, and start time

### Check-in/out workflow
- Check Out and Return buttons appear on the booking card in My Bookings page
- Check Out button becomes available 30 minutes before the scheduled start time
- If no checkout within 1 hour of start time, booking auto-cancels (frees the vehicle)
- If no return by end time, booking status becomes "overdue" — visible to admin
- Return is a simple confirmation tap — no damage reporting (that's v2: MODR-01)

### Slot suggestions
- When a booking attempt conflicts, show both nearby available times for the same vehicle AND alternative vehicles at the same location for the original time
- Suggestions appear inline below the conflict message — no modal, no page change
- Show up to 3 alternatives (mix of time shifts and vehicle alternatives)
- Suggestions triggered only on booking conflict, not proactively on the availability view

### Admin booking control
- All-bookings view is a sortable table with filters for location, status, date range, and employee
- Cancel flow: confirmation dialog with a required reason field; reason is stored and displayed to the affected employee
- Cancelled booking shows as "Cancelled by Admin" with the reason on the employee's My Bookings page (in-app only — email notification is Phase 6)
- Admin cannot create bookings on behalf of employees — cancel only

### Claude's Discretion
- Calendar timeline component implementation (library choice, rendering approach)
- Exact color palette for booking status blocks
- Auto-cancel scheduling mechanism (timer-based, cron, or on-access check)
- Table pagination and default sort order for admin view
- Suggestion ranking algorithm (nearest time first vs same-category vehicle first)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-booking-lifecycle-and-admin-oversight*
*Context gathered: 2026-02-24*
