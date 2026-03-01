---
phase: quick-4
plan: 1
subsystem: database
tags: [mssql, check-constraint, schema-migration, booking-status]

requires:
  - phase: 04-booking-lifecycle
    provides: "Overdue status concept and autoExpireBookings logic"
provides:
  - "setup-db.js creates Bookings table with 5-value CHECK constraint including Overdue"
  - "getMyBookingsEndpoint no longer crashes on Overdue status update"
affects: [booking-lifecycle, api-endpoints]

tech-stack:
  added: []
  patterns: ["Dynamic SQL for dropping auto-named constraints", "Named CHECK constraints for explicit schema control"]

key-files:
  created: []
  modified: [api/setup-db.js]

key-decisions:
  - "Matched schema.sql Phase 4 migration exactly -- dynamic SQL to drop auto-named constraint, then named CK_Bookings_Status"

patterns-established:
  - "Named constraints: Use CK_TableName_ColumnName pattern for explicit constraint management"

requirements-completed: [QUICK-4]

duration: 1min
completed: 2026-03-01
---

# Quick Task 4: Fix getMyBookingsEndpoint CHECK Constraint Summary

**Added Overdue to Bookings status CHECK constraint in setup-db.js, matching schema.sql Phase 4 migration, to fix autoExpireBookings runtime crash**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-01T14:02:37Z
- **Completed:** 2026-03-01T14:03:31Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed CHECK constraint on Bookings.status to include all 5 valid statuses: Confirmed, Active, Completed, Cancelled, Overdue
- Added dynamic SQL to drop the auto-generated inline constraint before creating the named replacement
- Ensures setup-db.js works on both fresh databases and existing ones with the old 4-value constraint

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Overdue status to Bookings CHECK constraint in setup-db.js** - `297182a` (fix)

**Plan metadata:** `cc90793` (docs: complete plan)

## Files Created/Modified
- `api/setup-db.js` - Added 2 SQL statements: (1) dynamic SQL to drop old inline CHECK, (2) named CK_Bookings_Status with 5 statuses

## Decisions Made
- Matched schema.sql Phase 4 migration exactly (lines 86-97) for consistency between schema definition and setup script
- Used dynamic SQL with sys.check_constraints lookup since auto-generated constraint names vary per database instance
- Placed statements after booking lifecycle columns and before calendar integration columns to maintain logical grouping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Run `node api/setup-db.js` against the database to apply the constraint fix.

## Next Steps
- The getMyBookingsEndpoint should no longer throw CHECK constraint errors when autoExpireBookings sets booking status to Overdue

## Self-Check: PASSED

- FOUND: api/setup-db.js
- FOUND: 4-SUMMARY.md
- FOUND: commit 297182a

---
*Quick Task: 4*
*Completed: 2026-03-01*
