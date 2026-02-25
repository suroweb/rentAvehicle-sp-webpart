---
phase: 06-notifications
plan: 02
subsystem: api
tags: [azure-functions-timer, graph-api, teams-activity-feed, scheduled-reminders, mssql]

# Dependency graph
requires:
  - phase: 06-notifications
    plan: 01
    provides: notificationService.ts (sendTeamsActivityNotification, getManagerInfo), adaptiveCards.ts (buildReminderPreview, buildOverduePreview)
provides:
  - Timer-triggered Azure Function running every 5 minutes for scheduled reminders
  - Pickup reminder processing (1 hour before booking start)
  - Return reminder processing (1 hour before booking return)
  - Overdue notification processing (15 minutes after return + grace period)
  - Multi-recipient overdue alerts (employee + manager + admin)
  - Database-level duplicate prevention via atomic UPDATE...WHERE sentAt IS NULL
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [timer-trigger-ncrontab, batch-processing-rate-limit, atomic-duplicate-prevention]

key-files:
  created:
    - api/src/functions/notifications.ts
  modified:
    - api/src/services/notificationService.ts
    - api/src/index.ts

key-decisions:
  - "6-field NCRONTAB schedule '0 */5 * * * *' for 5-minute interval timer trigger"
  - "Batch size of 10 with 1-second delay between batches for Graph API rate limiting"
  - "OVERDUE_ADMIN_EMAIL env var looks up admin userId via Graph /users/{email} for Teams notification"
  - "Overdue processing transitions Active bookings to Overdue status before sending notifications"

patterns-established:
  - "processBatch helper: generic batched async processing with configurable delay for rate limiting"
  - "Atomic sentAt update: UPDATE...WHERE sentAt IS NULL prevents duplicate notifications across function instances"
  - "Context-aware logging: (context || console).error for functions callable from both timer and direct invocation"

requirements-completed: [NOTF-02, NOTF-04]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 6 Plan 02: Scheduled Reminders Summary

**Timer-triggered Azure Function with pickup/return/overdue reminder processing and database-level duplicate prevention**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 1 (auto task; human-verify checkpoint auto-approved)
- **Files modified:** 3

## Accomplishments
- Timer function processes pickup, return, and overdue reminders every 5 minutes via NCRONTAB schedule
- Reminders are never sent twice for the same booking (database-level `sentAt IS NULL` atomic UPDATE)
- Overdue notifications reach employee, manager (via Graph /users/{id}/manager), and admin (via OVERDUE_ADMIN_EMAIL env var)
- Batch processing with 1-second delay between batches of 10 prevents Graph API rate limiting

## Task Commits

Each task was committed atomically:

1. **Task 1: Timer function and reminder processing** - `905ba97` (feat)

## Files Created/Modified
- `api/src/functions/notifications.ts` - Timer-triggered function running every 5 minutes, dispatches all 3 reminder types in parallel
- `api/src/services/notificationService.ts` - Added processPickupReminders, processReturnReminders, processOverdueNotifications, and processBatch helper
- `api/src/index.ts` - Added import for notifications function module

## Decisions Made
- Used `(context || console).error` pattern so reminder functions can be called from both the timer trigger (with InvocationContext) and potentially from tests or direct invocation
- Overdue transition happens inside processOverdueNotifications -- if a booking is Active and past the 15-minute grace period, it gets transitioned to Overdue before sending notifications

## Deviations from Plan

None - plan executed exactly as written

## User Setup Required

**Optional environment variable:**
- **OVERDUE_ADMIN_EMAIL** - Set to an admin user's email to receive overdue booking alerts via Teams activity feed

## Next Phase Readiness
- Phase 6 notification system is complete
- Ready for Phase 7: Reporting and Manager Visibility

---
*Phase: 06-notifications*
*Completed: 2026-02-25*
