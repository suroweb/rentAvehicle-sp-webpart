---
phase: 02-vehicle-inventory-and-locations
plan: 02
subsystem: api, services
tags: [crud, vehicle-management, category-management, location-sync, graph-api, mssql, parameterized-sql, rbac, location-scoping, lazy-sync]

# Dependency graph
requires:
  - phase: 02-vehicle-inventory-and-locations
    provides: SQL schema, connection pool, Vehicle/Category/Location models, zod validation, SuperAdmin role
provides:
  - Vehicle CRUD service (7 functions) with location-scoped access for Admin role
  - Category CRUD service (4 functions) with soft delete
  - Graph API service for extracting distinct officeLocation values with pagination
  - Location service with sync (add/deactivate/reactivate) and lazy-sync (ensureLocationsSynced)
  - 12 new HTTP endpoints (6 vehicles, 4 categories, 2 locations) with role-based access
  - Updated entry point importing all function modules
affects: [02-03-PLAN, 02-04-PLAN, 03-employee-vehicle-browsing, all Phase 2+ plans consuming API]

# Tech tracking
tech-stack:
  added: ["@microsoft/microsoft-graph-client@3.x"]
  patterns: ["Parameterized SQL with dynamic WHERE clause building", "Location-scoped access: Admin filtered by officeLocation, SuperAdmin unrestricted", "Lazy-sync pattern: ensureLocationsSynced checks lastSyncedAt > 24h before auto-syncing", "Soft delete: isArchived=1 for vehicles, isActive=0 for categories/locations", "Graph API pagination via @odata.nextLink with client-side deduplication"]

key-files:
  created:
    - api/src/services/vehicleService.ts
    - api/src/services/categoryService.ts
    - api/src/services/graphService.ts
    - api/src/services/locationService.ts
    - api/src/functions/vehicles.ts
    - api/src/functions/categories.ts
    - api/src/functions/locations.ts
  modified:
    - api/src/index.ts
    - api/local.settings.json
    - api/package.json

key-decisions:
  - "Graph API token null check: getToken() can return null, added explicit null guard with descriptive error"
  - "Admin location scoping returns 403 when officeLocation is null or not found in Locations table"

patterns-established:
  - "Pattern: resolveLocationIdForAdmin helper for reusable Admin location scoping across endpoints"
  - "Pattern: Lazy-sync (ensureLocationsSynced) triggers Graph API sync only when no data or stale >24h"
  - "Pattern: Location sync handles 3 states: add new, deactivate removed, reactivate returned"
  - "Pattern: All CRUD endpoints follow auth check -> validation -> service call -> error handling structure"

requirements-completed: [VHCL-01, VHCL-02, VHCL-03, VHCL-04, VHCL-05, M365-04]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 2 Plan 2: Vehicle CRUD, Category, and Location Sync API Endpoints Summary

**12 REST API endpoints for vehicle CRUD (location-scoped), category management, and Graph API location sync with lazy-sync and pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T02:57:58Z
- **Completed:** 2026-02-23T03:02:08Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Vehicle service layer with 7 functions: resolveLocationIdForAdmin, getVehicles, getVehicleById, createVehicle, updateVehicle, archiveVehicle, updateVehicleStatus -- all with parameterized SQL
- Category service layer with 4 functions: getCategories, createCategory, updateCategory, archiveCategory -- soft delete via isActive=0
- Graph API service that paginates through all Entra ID users to extract distinct officeLocation values with deduplication and whitespace trimming
- Location service with sync logic (add new, deactivate removed, reactivate returned) and lazy-sync that auto-triggers when data is missing or stale (>24h)
- 6 vehicle endpoints enforcing Admin/SuperAdmin roles with Admin location-scoping (cannot override via query params)
- 4 category endpoints enforcing Admin/SuperAdmin roles
- 2 location endpoints: list with vehicle counts (Admin+SuperAdmin, triggers lazy-sync) and manual sync trigger (SuperAdmin only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vehicle and category service layers and HTTP endpoints** - `f701291` (feat)
2. **Task 2: Create Graph API location sync service and location HTTP endpoints** - `0d7596c` (feat)

## Files Created/Modified
- `api/src/services/vehicleService.ts` - Vehicle CRUD operations with location scoping (7 exported functions)
- `api/src/services/categoryService.ts` - Category CRUD operations (4 exported functions)
- `api/src/services/graphService.ts` - Graph API client with dual auth (ClientSecretCredential local / DefaultAzureCredential prod), getDistinctOfficeLocations with pagination
- `api/src/services/locationService.ts` - Location queries with vehicle counts, sync logic (add/deactivate/reactivate), lazy-sync ensureLocationsSynced
- `api/src/functions/vehicles.ts` - 6 HTTP endpoints for vehicle CRUD with location-scoped Admin access
- `api/src/functions/categories.ts` - 4 HTTP endpoints for category CRUD
- `api/src/functions/locations.ts` - 2 HTTP endpoints for location list (with lazy-sync) and manual sync
- `api/src/index.ts` - Added imports for vehicles.js, categories.js, locations.js
- `api/local.settings.json` - Added AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET placeholders
- `api/package.json` - Added @microsoft/microsoft-graph-client dependency

## Decisions Made
- **Graph API token null check:** `credential.getToken()` can return null per TypeScript types. Added explicit null guard with descriptive error message rather than using non-null assertion.
- **Admin location scoping returns 403:** When an Admin user's officeLocation is null or not found in the Locations table, the API returns 403 with a descriptive message ("Contact a Super Admin") rather than silently returning empty results. This makes the misconfiguration visible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Graph API token null check**
- **Found during:** Task 2 (graphService.ts creation)
- **Issue:** `credential.getToken()` returns `AccessToken | null` per `@azure/identity` types. Accessing `.token` on null would fail. TypeScript strict mode caught this (TS18047).
- **Fix:** Added `if (!tokenResponse) { throw new Error('Failed to acquire Graph API token'); }` before accessing the token property.
- **Files modified:** `api/src/services/graphService.ts`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `0d7596c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for TypeScript compilation under strict mode. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required

Graph API location sync requires Microsoft Entra ID configuration. Environment variables to set in `api/local.settings.json`:
- `AZURE_TENANT_ID` - Azure Portal > Entra ID > Overview > Tenant ID
- `AZURE_CLIENT_ID` - Azure Portal > App registrations > RentAVehicle API > Application (client) ID
- `AZURE_CLIENT_SECRET` - Azure Portal > App registrations > RentAVehicle API > Certificates & secrets > New client secret

Additionally, grant `User.Read.All` application permission with admin consent:
- Azure Portal > App registrations > RentAVehicle API > API permissions > Add > Microsoft Graph > Application > User.Read.All > Grant admin consent

## Next Phase Readiness
- All 12 API endpoints registered and compiling (6 vehicles, 4 categories, 2 locations)
- Ready for Plan 03 (SPFx frontend components) to consume these endpoints
- Ready for Plan 04 (integration testing and verification)
- Graph API configuration needed before location sync will function in local dev
- Both projects compile clean with zero TypeScript errors

## Self-Check: PASSED

All 7 created files and 3 modified files verified on disk. Both task commits (f701291, 0d7596c) verified in git log. SUMMARY.md exists.

---
*Phase: 02-vehicle-inventory-and-locations*
*Completed: 2026-02-23*
