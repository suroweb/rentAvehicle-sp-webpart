# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Employees can quickly find and book an available vehicle at their location -- self-service, no approval bottleneck.
**Current focus:** Phase 5: M365 Calendar Integration -- Complete (2 of 2 plans done).

## Current Position

Phase: 5 of 7 (M365 Calendar Integration)
Plan: 2 of 2 in current phase (05-02 complete)
Status: Phase Complete
Last activity: 2026-02-25 -- Completed 05-02-PLAN.md (Admin Provisioning, Backfill Migration, and Calendar Verification)

Progress: [########..] 82%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 5.1min
- Total execution time: 1.22 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 P01 | 16min | 2 tasks | 40 files |
| Phase 01 P02 | 4min | 2 tasks | 20 files |
| Phase 01 P03 | 5min | 2 tasks | 0 files |
| Phase 02 P01 | 3min | 2 tasks | 14 files |
| Phase 02 P02 | 4min | 2 tasks | 10 files |
| Phase 02 P03 | 5min | 2 tasks | 12 files |
| Phase 02 P04 | 4min | 2 tasks | 9 files |
| Phase 03 P01 | 3min | 2 tasks | 7 files |
| Phase 03 P02 | 8min | 2 tasks | 11 files |
| Phase 03 P03 | 5min | 2 tasks | 5 files |
| Phase 04 P01 | 4min | 2 tasks | 6 files |
| Phase 04 P02 | 9min | 2 tasks | 11 files |
| Phase 04 P03 | 5min | 2 tasks | 3 files |
| Phase 05 P01 | 3min | 2 tasks | 6 files |
| Phase 05 P02 | 4min | 2 tasks | 6 files |

**Recent Trend:**
- Last 5 plans: 4min, 9min, 5min, 3min, 4min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Node.js 22 + TypeScript for Azure Functions (shared runtime with SPFx frontend)
- [Roadmap]: Azure SQL is single source of truth; Exchange calendars are write-through display layer
- [Roadmap]: React 17.0.1 exact pin required (React 18 breaks SPFx 1.22)
- [Roadmap]: Fluent UI v8 only (v9 has known rendering issues in SPFx context)
- [Phase 01]: Route uses 'backoffice/health' instead of 'admin/health' - Azure Functions reserves /admin prefix
- [Phase 01]: Azure Functions v4 Node.js requires explicit imports of function modules in entry point (no auto-discovery)
- [Phase 01]: Role badge placed in sidebar footer, not header -- keeps header clean
- [Phase 01]: AuthContext provides fallback Employee role user when API call fails -- shell still renders
- [Phase 01]: BottomTabBar MAX_VISIBLE_TABS = 4 (top 3 items + More)
- [Phase 01]: ErrorBoundary uses Fluent UI MessageBar for inline error, not modal
- [Phase 01]: No code changes needed during integration verification -- both projects built clean on first attempt
- [Phase 02]: AzureActiveDirectoryDefaultAuthentication requires explicit options object with clientId (even when undefined)
- [Phase 02]: SuperAdmin role badge uses purple (#881798) to distinguish from Admin orange (#d83b01)
- [Phase 02]: Graph API token null check -- getToken() can return null, added explicit null guard
- [Phase 02]: Admin location scoping returns 403 when officeLocation null or not found in Locations table
- [Phase 02]: Two-step status change flow: pick status then confirm with impact explanation
- [Phase 02]: ApiService uses AadHttpClient.fetch() for PUT/PATCH/DELETE (only get/post are native methods)
- [Phase 02]: Base64 data URL for Phase 2 photo storage -- deferred Azure Blob Storage with Valet Key pattern
- [Phase 02]: Inline category editing in-place vs separate form -- simpler UX for small category count
- [Phase 02]: FleetManagement table-to-form toggle via showForm state -- full-page form locked decision within SPA
- [Phase 03]: Employee-facing endpoints use /api/vehicles/* and /api/bookings/* (not /api/backoffice/) -- all authenticated users
- [Phase 03]: getVehicleDetail does not filter by status=Available -- employees see detail even if unavailable
- [Phase 03]: cancelBooking validates startTime > now -- cannot cancel already-started bookings
- [Phase 03]: SQL Server deadlock error 1205 treated as conflict (409) not server error (500)
- [Phase 03]: ES5-compatible timezone: formatToParts/padStart unavailable, used formatted string parsing and pad2() instead
- [Phase 03]: localToUtcIso offset via Intl.DateTimeFormat formatted date parsing (no formatToParts needed)
- [Phase 03]: postWithConflict helper prefixes 409 errors with 'CONFLICT:' for UI conflict detection
- [Phase 03]: Frontend ILocation extended with optional timezone field to match backend
- [Phase 03]: Booking categorization derives Active from time comparison (no explicit Active status in Phase 3)
- [Phase 03]: Sub-navigation uses selectedVehicleId state in AppShell (browse->detail), not URL routing
- [Phase 03]: Cancel flow re-fetches full booking list after API cancel (data consistency over optimistic update)
- [Phase 04]: Lazy expiration on access (not timer-based) for auto-cancel and overdue detection
- [Phase 04]: autoExpireBookings in getMyBookings, getAvailableVehicles, getAllBookings only (not browse/availability)
- [Phase 04]: getMyBookings returns all statuses including Cancelled (for admin cancel reason display)
- [Phase 04]: Atomic UPDATE with WHERE status check for checkout/checkin (no SERIALIZABLE needed for single-row)
- [Phase 04]: Suggestions: up to 2 time shifts (+/-1h through +/-4h), remaining slots filled with alt vehicles
- [Phase 04]: Dynamic WHERE clause for getAllBookings admin filters
- [Phase 04]: postWithConflict returns structured IConflictResponse instead of throwing, enabling suggestions display
- [Phase 04]: MyBookings uses explicit backend statuses (Active/Overdue/Cancelled) replacing Phase 3 time-based Active derivation
- [Phase 04]: Suggestions inline below conflict MessageBar -- time_shift updates form, alt_vehicle navigates to vehicle
- [Phase 04]: Admin locations loaded at AppShell level for shared admin page state (not per-component)
- [Phase 04]: Inline Intl.DateTimeFormat per cell for admin table -- each row may have different location timezone
- [Phase 04]: Cancel dialog uses full Dialog (not ConfirmDialog) for embedded TextField with required reason
- [Phase 04]: Explicit Apply Filters button (not auto-fetch) for admin views to reduce API call volume
- [Phase 05]: Two separate calendar events (not invitation-based) using application permissions
- [Phase 05]: Fire-and-forget calendar sync -- calendar failures never block booking operations
- [Phase 05]: Vehicle resource events showAs=busy, employee events showAs=free (no Teams presence impact)
- [Phase 05]: Status updates prepend [CANCELLED]/[IN USE]/[RETURNED] to subject (events never deleted)
- [Phase 05]: time_modified action implemented as future-wiring hook (no endpoint yet)
- [Phase 05]: Two-step admin provisioning: PowerShell script + API endpoint (Graph API cannot create mailboxes)
- [Phase 05]: Backfill processes in batches of 10 with 2-second delay for Graph API rate limiting
- [Phase 05]: SuperAdmin-only access for backfill endpoint (bulk/destructive operation)
- [Phase 05]: Equipment mailbox BookInPolicy restricts booking to app service account only

### Pending Todos

3 pending todo(s) in `.planning/todos/pending/`

### Blockers/Concerns

- Exchange equipment mailbox licensing must be confirmed before Phase 5 (M365 Calendar Integration)
- @pnp/spfx-controls-react 3.23.0 compatibility with SPFx 1.22 Heft build needs validation in Phase 1

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 05-02-PLAN.md
Resume file: .planning/phases/05-m365-calendar-integration/05-02-SUMMARY.md
