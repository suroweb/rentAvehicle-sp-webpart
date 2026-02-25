---
phase: 06-notifications
plan: 01
subsystem: api
tags: [graph-api, sendmail, teams-activity-feed, notifications, email, mssql]

# Dependency graph
requires:
  - phase: 05-calendar-integration
    provides: graphService.ts shared Graph client, calendarService.ts fire-and-forget pattern, APP_BASE_URL env var
  - phase: 03-core-booking
    provides: bookingService.ts, bookings.ts endpoints, Bookings table schema
provides:
  - Notification service with email confirmations via Graph sendMail API
  - Teams activity feed notifications via Graph teamwork API
  - Manager lookup via Graph /users/{id}/manager
  - HTML email template with styled action buttons (View/Cancel deep links)
  - Adaptive card preview text builders for activity feed
  - Booking endpoint wiring for fire-and-forget notification dispatch
  - Schema migration for reminder tracking columns (pickupReminderSentAt, returnReminderSentAt, overdueNotificationSentAt)
affects: [06-02, 07-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns: [graph-sendmail, teams-activity-feed, fire-and-forget-notifications, preview-text-builders]

key-files:
  created:
    - api/src/services/notificationService.ts
    - api/src/templates/emailConfirmation.ts
    - api/src/templates/adaptiveCards.ts
  modified:
    - api/src/functions/bookings.ts
    - api/src/functions/adminBookings.ts
    - api/src/sql/schema.sql

key-decisions:
  - "Teams activity feed with deep links instead of bot-based Adaptive Cards -- simpler setup, native M365 feel"
  - "Promise.allSettled for parallel notification dispatch -- one failure cannot block others"
  - "Admin cancel notification uses IIFE pattern for fire-and-forget async in switch/case"

patterns-established:
  - "sendTeamsActivityNotification: generic Graph activity feed notification sender reusable across all notification types"
  - "buildXxxPreview: preview text builder pattern for consistent activity feed formatting"
  - "sendBookingNotifications orchestrator: parallel dispatch with Promise.allSettled and error logging"

requirements-completed: [NOTF-01, NOTF-03, NOTF-04]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 6 Plan 01: Notification Service Summary

**Graph API notification service with email confirmations, Teams activity feed, and manager alerts wired into booking endpoints**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Email confirmation service sends rich HTML emails via Graph sendMail API through configured sender mailbox
- Teams activity feed notifications with deep links back to SPFx webpart for booking confirmations, manager alerts, and admin cancellations
- Manager lookup via Graph /users/{id}/manager with graceful 404 handling
- All notification dispatch is fire-and-forget using the same pattern as calendarService

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Create notification service, templates, and wire into endpoints** - `db2d7de` (feat)

## Files Created/Modified
- `api/src/services/notificationService.ts` - Email sending, Teams activity feed, manager lookup, notification orchestrator
- `api/src/templates/emailConfirmation.ts` - HTML email template with booking details, styled View/Cancel buttons
- `api/src/templates/adaptiveCards.ts` - Preview text builders for Teams activity feed (confirmation, manager alert, reminder, overdue)
- `api/src/functions/bookings.ts` - Added sendBookingNotifications fire-and-forget call in createBookingEndpoint
- `api/src/functions/adminBookings.ts` - Added admin cancel notification to affected employee via Teams activity feed
- `api/src/sql/schema.sql` - Added Phase 6 reminder tracking columns (pickupReminderSentAt, returnReminderSentAt, overdueNotificationSentAt)

## Decisions Made
- Used Teams activity feed with deep links rather than bot-based Adaptive Cards -- matches user decision for "no bot registration" while providing native M365 activity experience
- Admin cancel notification in adminBookings.ts uses an IIFE pattern `(async () => { ... })()` for fire-and-forget async operations within a switch/case block
- Manager lookup returns null on 404 (no manager) -- treats absence of manager as normal, not an error

## Deviations from Plan

None - plan executed exactly as written

## User Setup Required

**External services require manual configuration:**
- **NOTIFICATION_SENDER_EMAIL** env var: Set to a shared mailbox in M365 tenant (e.g., rentavehicle@contoso.com)
- **Mail.Send** application permission: Grant in Entra ID app registration
- **TeamsActivity.Send.User** application permission: Grant in Entra ID app registration
- **APP_BASE_URL** env var: Already configured from Phase 5

## Next Phase Readiness
- Notification service is ready for Plan 06-02 to add timer-triggered scheduled reminders
- Preview text builders for reminders and overdue are already exported and ready for use
- Schema columns for reminder tracking are in place

---
*Phase: 06-notifications*
*Completed: 2026-02-25*
