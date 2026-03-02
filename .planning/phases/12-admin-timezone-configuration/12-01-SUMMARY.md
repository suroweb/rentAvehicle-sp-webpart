---
phase: 12-admin-timezone-configuration
plan: 01
subsystem: api
tags: [timezone, iana, zod, patch-endpoint, intl-datetimeformat, fluent-ui]

# Dependency graph
requires:
  - phase: 05-admin-views
    provides: "Location model and locationService with getLocationsWithVehicleCounts"
provides:
  - "PATCH /api/backoffice/locations/{id}/timezone endpoint with Zod validation"
  - "updateTimezone service function with parameterized SQL"
  - "TimezoneUpdateSchema Zod schema with IANA validation via Intl.DateTimeFormat"
  - "getLocationsWithVehicleCounts now returns timezone field"
  - "TIMEZONE_OPTIONS static data module with 419 IANA timezones for frontend picker"
affects: [12-02-notification-timezone-conversion, 12-03-frontend-timezone-picker, 12-04-integration-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Zod .refine() with Intl.DateTimeFormat for IANA timezone validation", "Static data module generation from Intl.supportedValuesOf"]

key-files:
  created:
    - spfx/src/webparts/rentaVehicle/data/timezones.ts
  modified:
    - api/src/models/Location.ts
    - api/src/services/locationService.ts
    - api/src/functions/locations.ts

key-decisions:
  - "Added UTC explicitly to timezone list since Intl.supportedValuesOf does not include it but DB default is 'UTC'"
  - "Used January 15, 2026 as standard time baseline for offset computation to avoid DST ambiguity"

patterns-established:
  - "IANA timezone validation: Zod .refine() wrapping Intl.DateTimeFormat try/catch"
  - "Static data generation: Node.js script using Intl.supportedValuesOf for compile-time data"

requirements-completed: [FEAT-01]

# Metrics
duration: 14min
completed: 2026-03-02
---

# Phase 12 Plan 01: API + Data Foundation Summary

**PATCH timezone endpoint with Zod IANA validation, fixed locations query to include timezone, and 419-entry static IANA timezone data module for frontend picker**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-02T08:46:36Z
- **Completed:** 2026-03-02T09:00:31Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- TimezoneUpdateSchema with Zod .refine() validates IANA identifiers via Intl.DateTimeFormat at runtime
- PATCH /api/backoffice/locations/{id}/timezone endpoint with Admin+SuperAdmin authorization, 401/403/400/404/500 error handling
- getLocationsWithVehicleCounts query now returns l.timezone in SELECT and GROUP BY
- Static TIMEZONE_OPTIONS array with 419 IANA timezones sorted by UTC offset, compatible with Fluent UI ComboBox

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TimezoneUpdateSchema to Location model** - `33a90c1` (feat)
2. **Task 2: Add updateTimezone service function and fix getLocationsWithVehicleCounts query** - `6cd6a0b` (feat)
3. **Task 3: Add PATCH timezone endpoint to locations.ts** - `391f9e4` (feat)
4. **Task 4: Generate static IANA timezone data module** - `58bce6b` (feat)

## Files Created/Modified
- `api/src/models/Location.ts` - Added TimezoneUpdateSchema Zod validation with IANA refine
- `api/src/services/locationService.ts` - Fixed getLocationsWithVehicleCounts to include l.timezone, added updateTimezone function
- `api/src/functions/locations.ts` - PATCH /api/backoffice/locations/{id}/timezone endpoint with route registration
- `spfx/src/webparts/rentaVehicle/data/timezones.ts` - Static 419-entry IANA timezone data for ComboBox picker

## Decisions Made
- Added UTC explicitly to timezone options list: Intl.supportedValuesOf('timeZone') does not include bare "UTC" but it is the DB column default and a valid IANA identifier accepted by Intl.DateTimeFormat
- Used January 15, 2026 as the offset computation baseline to get standard (winter) time offsets, avoiding DST ambiguity in display labels

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added UTC to timezone options list**
- **Found during:** Task 4 (Generate static IANA timezone data module)
- **Issue:** Intl.supportedValuesOf('timeZone') does not return "UTC" but the DB column default is 'UTC', meaning locations with default timezone would not be selectable in the picker
- **Fix:** Explicitly added "UTC" to the generated zones list before sorting
- **Files modified:** spfx/src/webparts/rentaVehicle/data/timezones.ts
- **Verification:** grep confirms UTC entry present with (UTC+00:00) offset label
- **Committed in:** 58bce6b (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- DB default value must be selectable in picker. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API foundation complete for timezone management
- Plan 02 (notification timezone conversion) can use updateTimezone service and l.timezone from queries
- Plan 03 (frontend timezone picker) can import TIMEZONE_OPTIONS directly
- API compiles cleanly with zero TypeScript errors

## Self-Check: PASSED

All 4 created/modified files verified on disk. All 4 task commits verified in git log.

---
*Phase: 12-admin-timezone-configuration*
*Completed: 2026-03-02*
