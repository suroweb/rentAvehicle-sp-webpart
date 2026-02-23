---
phase: 03-core-booking-flow
plan: 01
subsystem: api, database
tags: [mssql, zod, serializable, transactions, booking, azure-functions]

# Dependency graph
requires:
  - phase: 02-vehicle-inventory-and-locations
    provides: "Vehicles/Categories/Locations tables, vehicleService patterns, auth middleware"
provides:
  - "Bookings table DDL with CHECK constraints and 3 performance indexes"
  - "Locations.timezone IANA timezone column"
  - "BookingInputSchema Zod validation with hourly precision"
  - "bookingService with SERIALIZABLE double-booking prevention"
  - "6 employee-facing API endpoints (vehicles/available, vehicles/{id}/detail, vehicles/{id}/availability, bookings, bookings/my, bookings/{id})"
  - "/api/me officeLocation field for frontend location auto-detection"
affects: [03-core-booking-flow, 04-admin-booking-management, 05-m365-calendar-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SERIALIZABLE transaction for range-based concurrency control"
    - "NOT EXISTS subquery for availability filtering"
    - "Half-open interval overlap check (startTime < endTime AND endTime > startTime)"
    - "Employee-facing endpoints under /api/ (vs admin /api/backoffice/)"

key-files:
  created:
    - "api/src/models/Booking.ts"
    - "api/src/services/bookingService.ts"
    - "api/src/functions/bookings.ts"
  modified:
    - "api/src/sql/schema.sql"
    - "api/src/models/Location.ts"
    - "api/src/functions/me.ts"
    - "api/src/index.ts"

key-decisions:
  - "Employee-facing endpoints use /api/vehicles/* and /api/bookings/* routes (not /api/backoffice/) since all authenticated users access them"
  - "getVehicleDetail does not filter by status=Available so employees see vehicle detail even if it becomes unavailable (booking form fails gracefully)"
  - "cancelBooking validates startTime > now (cannot cancel already-started bookings)"
  - "Deadlock error 1205 treated as conflict (409) not server error (500)"

patterns-established:
  - "SERIALIZABLE transaction: check-then-insert with range locks for double-booking prevention"
  - "NOT EXISTS subquery: filter available vehicles by excluding overlapping bookings"
  - "Employee endpoint pattern: auth check only (no role check), all authenticated users can access"

requirements-completed: [BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05, BOOK-06]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 3 Plan 1: Core Booking Backend Summary

**Bookings table with SERIALIZABLE double-booking prevention, 6 employee-facing API endpoints, and /api/me officeLocation extension**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T11:52:54Z
- **Completed:** 2026-02-23T11:55:33Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Bookings table DDL with DATETIME2 UTC columns, status CHECK constraint, time ordering constraint, and 3 performance indexes
- bookingService with SERIALIZABLE transaction-based createBooking that prevents double-bookings and handles SQL Server deadlock error 1205
- 6 employee-facing API endpoints: browse available vehicles, vehicle detail, vehicle availability, create booking, my bookings, cancel booking
- /api/me extended with officeLocation for frontend location auto-detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Bookings table schema, Locations.timezone column, and Booking TypeScript model** - `5c1006d` (feat)
2. **Task 2: Build booking service with SERIALIZABLE transactions and employee-facing API endpoints** - `083a41e` (feat)

**Plan metadata:** `1767a0c` (docs: complete plan)

## Files Created/Modified
- `api/src/sql/schema.sql` - Bookings table DDL, Locations.timezone ALTER, 3 performance indexes
- `api/src/models/Booking.ts` - BookingInputSchema (hourly precision), IBooking, IAvailableVehicle, IVehicleAvailabilitySlot
- `api/src/models/Location.ts` - Added timezone field to ILocation interface
- `api/src/services/bookingService.ts` - 6 functions: getAvailableVehicles, getVehicleDetail, getVehicleAvailability, createBooking (SERIALIZABLE), getMyBookings, cancelBooking
- `api/src/functions/bookings.ts` - 6 employee-facing HTTP endpoints registered with app.http()
- `api/src/functions/me.ts` - Extended response to include officeLocation
- `api/src/index.ts` - Added bookings module import for Azure Functions auto-discovery

## Decisions Made
- Employee-facing endpoints use `/api/vehicles/*` and `/api/bookings/*` routes (not `/api/backoffice/`) since all authenticated users access them
- `getVehicleDetail` does not filter by `status='Available'` -- employees should see the vehicle detail page even if it becomes unavailable (the booking form will fail gracefully)
- `cancelBooking` validates `startTime > now` to prevent cancelling already-started bookings
- SQL Server deadlock error 1205 treated as conflict (409 response) not server error (500)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Bookings table DDL must be applied to Azure SQL when deploying (schema.sql is the source of truth).

## Next Phase Readiness
- All 6 employee-facing API endpoints are ready for the frontend to consume
- bookingService provides the data contract (IBooking, IAvailableVehicle, IVehicleAvailabilitySlot) for SPFx frontend models
- /api/me officeLocation enables frontend location auto-detection for the vehicle browse filter
- Phase 3 Plan 2 (SPFx frontend pages) can proceed immediately

## Self-Check: PASSED

All 7 files verified present. Both task commits (5c1006d, 083a41e) verified in git log.

---
*Phase: 03-core-booking-flow*
*Completed: 2026-02-23*
