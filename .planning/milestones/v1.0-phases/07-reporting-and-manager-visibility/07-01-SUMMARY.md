---
phase: 07-reporting-and-manager-visibility
plan: 01
subsystem: api
tags: [mssql, reporting, sql-aggregation, graph-api, directReports, csv-export, privacy]

# Dependency graph
requires:
  - phase: 04-booking-lifecycle-and-admin-oversight
    provides: Bookings table with status lifecycle, getAllBookings pattern
  - phase: 06-notifications
    provides: Graph API directReports pattern, getGraphClient
provides:
  - reportingService.ts with 7 service functions for SQL aggregation and Graph team lookup
  - 4 admin reporting endpoints under /api/backoffice/reports/*
  - 1 manager team bookings endpoint at /api/backoffice/team-bookings
  - Report.ts model interfaces (API side) and IReport.ts (frontend side)
  - DatePreset type and getDateRange utility for frontend date range picker
affects: [07-02 (dashboard frontend), 07-03 (team view frontend)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side SQL aggregation with date range clamping, parameterized IN clause for dynamic user lists, privacy-first raw data export]

key-files:
  created:
    - api/src/services/reportingService.ts
    - api/src/models/Report.ts
    - api/src/functions/reporting.ts
    - api/src/functions/teamBookings.ts
    - spfx/src/webparts/rentaVehicle/models/IReport.ts
  modified:
    - api/src/index.ts

key-decisions:
  - "Utilization rate calculated in TypeScript (not SQL) to avoid SQL division precision issues"
  - "Raw booking export includes all statuses including Cancelled for complete fleet picture"
  - "Team bookings scope: current + upcoming only (privacy-first, no historical tracking)"
  - "getBookingTrends utilizationPct uses booking count * period hours / available hours estimation"

patterns-established:
  - "Server-side SQL aggregation: GROUP BY with DATEDIFF and CASE WHEN clamping for date range-bounded utilization"
  - "Parameterized IN clause: dynamic request.input() loop with @uid0..@uidN for safe list queries"
  - "Reporting endpoints: Admin-only under /api/backoffice/reports/* with date range validation"

requirements-completed: [RPRT-01, RPRT-02, RPRT-03, RPRT-04]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 7 Plan 1: Reporting Backend Summary

**SQL aggregation reporting service with 7 functions, 5 API endpoints (4 admin + 1 manager), and privacy-first raw data export**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T01:34:18Z
- **Completed:** 2026-02-25T01:37:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- reportingService.ts with 7 exported functions: KPI summary, location utilization, vehicle utilization, booking trends, anonymized raw data, Graph directReports, team bookings
- 5 new HTTP endpoints: GET kpi, utilization, trends, export (admin), team-bookings (manager)
- Frontend IReport.ts with all 6 matching interfaces plus DatePreset type and getDateRange utility
- All SQL queries use parameterized inputs; no string interpolation of user input
- Privacy enforced: IRawBookingRecord contains zero employee PII fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reporting service with SQL aggregation queries and Graph team lookup** - `6091df8` (feat)
2. **Task 2: Create reporting and team bookings API endpoints** - `606742b` (feat)

## Files Created/Modified
- `api/src/models/Report.ts` - 6 TypeScript interfaces for reporting data shapes
- `api/src/services/reportingService.ts` - 7 service functions: SQL aggregation queries and Graph team lookup
- `api/src/functions/reporting.ts` - 4 admin reporting HTTP endpoints under /api/backoffice/reports/*
- `api/src/functions/teamBookings.ts` - 1 manager team bookings HTTP endpoint at /api/backoffice/team-bookings
- `api/src/index.ts` - Added imports for reporting.js and teamBookings.js
- `spfx/src/webparts/rentaVehicle/models/IReport.ts` - Frontend interfaces matching API response shapes + date utilities

## Decisions Made
- Utilization rate calculated in TypeScript (Math.round) rather than SQL division to avoid precision issues with integer division
- Raw booking export includes all statuses (Confirmed, Active, Completed, Overdue, Cancelled) for complete fleet utilization picture
- Team bookings scope limited to current + upcoming only (endTime > GETUTCDATE()) -- privacy-first, past bookings excluded
- getBookingTrends utilizationPct uses approximate estimation (bookingCount * periodHours / totalAvailableHours) rather than per-booking hour clamping for simplicity
- getDateRange uses var instead of const/let for ES5 compatibility with SPFx build

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled clean on first attempt for both tasks.

## User Setup Required

None - no external service configuration required. All endpoints use existing Graph API permissions (User.Read.All already granted from Phase 2).

## Next Phase Readiness
- All 5 backend endpoints ready for frontend consumption in Plans 02 (dashboard) and 03 (team view)
- Frontend IReport.ts interfaces and getDateRange utility ready for component development
- @fluentui/react-charting installation needed in Plan 02 for chart rendering

## Self-Check: PASSED

All 6 files verified present on disk. Both task commits (6091df8, 606742b) verified in git log.

---
*Phase: 07-reporting-and-manager-visibility*
*Completed: 2026-02-25*
