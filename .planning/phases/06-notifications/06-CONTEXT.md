# Phase 6: Notifications - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Timely, actionable notifications about booking events through M365 channels. Covers: booking confirmation (email + Teams), pickup reminder, return reminder, overdue alerts, and manager awareness. Notification preferences UI and approval workflows are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Delivery channels
- Booking confirmation: Email + Teams Adaptive Card (email for record-keeping, Teams for quick glance)
- Pickup reminder: Teams Adaptive Card only (1 hour before start time)
- Return reminder: Teams Adaptive Card only (1 hour before return time)
- Overdue notification: Teams Adaptive Card to employee, admin, and manager (at return_time + 15 min grace)
- Manager booking alert: Teams Adaptive Card only (real-time, per-booking)
- Fixed behavior for all users — no per-user notification preference settings

### Reminder timing
- Pickup reminder: 1 hour before booking start time (Teams only)
- Return reminder: 1 hour before return time (Teams only)
- Overdue notification: 15 minutes after return time passes (with grace period)
- Overdue recipients: employee + admin + manager
- Implementation: scheduled Azure Function for time-based triggers

### Adaptive Card design
- Content level: key info only — vehicle make/model, booking dates, location, plate number
- Full details accessible via "View Booking" deep link to the webpart
- Confirmation card buttons: "View Booking" + "Cancel Booking" (cancel triggers cancellation from Teams)
- Reminder card buttons: "View Booking" + "Check In" (check-in triggers return from Teams)
- Manager card buttons: "View Booking" only (informational, no action)
- Overdue card: informational with "View Booking" link
- Delivery mechanism: Graph API activity feed notifications (no Teams bot registration)

### Manager notifications
- Triggered individually per booking in real-time (not daily digest)
- Manager determined from Entra ID manager field via Microsoft Graph API
- Informational only — "View Booking" button, no approve/cancel from card
- Manager also receives overdue alerts for their direct reports

### Claude's Discretion
- Email template design and formatting
- Adaptive Card JSON schema and styling details
- Azure Function scheduling implementation (timer trigger vs queue-based)
- Retry and failure handling for notification delivery
- Graph API activity feed setup details
- How deep links to webpart bookings are constructed

</decisions>

<specifics>
## Specific Ideas

- Confirmation email should include all booking details so it serves as a receipt/reference
- Teams cards should feel native to the M365 experience — not like external app spam
- "Check In" button on return reminder should complete the return without opening the app (action from Teams)
- "Cancel Booking" button on confirmation card should cancel directly from Teams
- Graph API activity feed chosen over bot framework for simpler setup and native feel

</specifics>

<deferred>
## Deferred Ideas

- Per-user notification preferences (mute, channel choice) — future phase
- Manager approval workflow for bookings — separate capability
- Notification history/log viewable in the app — future phase

</deferred>

---

*Phase: 06-notifications*
*Context gathered: 2026-02-25*
