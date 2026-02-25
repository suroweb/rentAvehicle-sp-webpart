---
phase: 02-vehicle-inventory-and-locations
plan: 01
subsystem: database, auth, models
tags: [mssql, azure-sql, zod, typescript, rbac, superadmin, connection-pool, sql-schema]

# Dependency graph
requires:
  - phase: 01-foundation-and-authentication
    provides: Auth middleware, UserContext model, AppRole type, SPFx IUser model
provides:
  - SQL schema DDL for Vehicles, Categories, Locations tables with indexes
  - Singleton Azure SQL connection pool (getPool) with dual auth mode
  - Vehicle TypeScript interfaces and zod validation schemas (VehicleInputSchema, VehicleStatusSchema)
  - Category TypeScript interfaces and zod validation schema (CategoryInputSchema)
  - Location TypeScript interfaces (ILocation, ILocationSyncResult)
  - 4-tier role hierarchy: SuperAdmin > Admin > Manager > Employee
  - UserContext.officeLocation field for location-scoped access
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN, all Phase 2 plans]

# Tech tracking
tech-stack:
  added: ["mssql@11.x", "@azure/identity@4.x", "@types/mssql"]
  patterns: ["Singleton connection pool for Azure SQL in Azure Functions", "Dual auth: SQL auth (local dev) vs Azure AD default (production)", "Zod schemas for vehicle/category input validation", "4-tier RBAC with SuperAdmin above Admin"]

key-files:
  created:
    - api/src/sql/schema.sql
    - api/src/services/database.ts
    - api/src/models/Vehicle.ts
    - api/src/models/Category.ts
    - api/src/models/Location.ts
  modified:
    - api/src/models/UserContext.ts
    - api/src/middleware/auth.ts
    - api/local.settings.json
    - api/package.json
    - spfx/src/webparts/rentaVehicle/models/IUser.ts
    - spfx/src/webparts/rentaVehicle/components/Sidebar/Sidebar.tsx
    - spfx/src/webparts/rentaVehicle/components/Sidebar/Sidebar.module.scss
    - spfx/src/webparts/rentaVehicle/styles/variables.module.scss

key-decisions:
  - "AzureActiveDirectoryDefaultAuthentication requires options object with clientId -- type system enforces it even when clientId is undefined"
  - "SuperAdmin role badge uses purple (#881798) to distinguish from Admin orange (#d83b01)"

patterns-established:
  - "Pattern: getPool() singleton -- check pool.connected before returning, create fresh pool if disconnected"
  - "Pattern: Dual auth mode -- AZURE_SQL_USER env var presence toggles SQL auth (local) vs Azure AD (production)"
  - "Pattern: Zod schemas for API input validation, separate interfaces for full DB records"
  - "Pattern: SQL schema with soft delete (isArchived + archivedAt) and audit fields (createdBy, updatedBy)"

requirements-completed: [VHCL-01, VHCL-05]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 2 Plan 1: Database Foundation, Models, and SuperAdmin Role Summary

**Azure SQL schema (3 tables, 4 indexes), singleton connection pool with dual auth, Vehicle/Category/Location TypeScript models with zod validation, and 4-tier SuperAdmin role hierarchy**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T02:50:20Z
- **Completed:** 2026-02-23T02:53:35Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- SQL schema defines Vehicles, Categories, and Locations tables with foreign keys, check constraints, and filtered indexes
- Database connection pool supports both SQL Server auth (local dev) and Azure AD default auth (Managed Identity in production)
- Vehicle model includes VehicleInputSchema and VehicleStatusSchema zod validation plus IVehicle and IVehicleFilters interfaces
- Category and Location models provide complete TypeScript interfaces and validation
- SuperAdmin role (level 3) added to both API and SPFx role hierarchies, with Sidebar badge styling
- UserContext gains officeLocation field for location-scoped Admin access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL schema, database connection pool, and TypeScript models** - `cdc469b` (feat)
2. **Task 2: Add SuperAdmin role to API auth middleware and SPFx role model** - `3edd50f` (feat)

## Files Created/Modified
- `api/src/sql/schema.sql` - DDL for Locations, Categories, Vehicles tables with 4 indexes
- `api/src/services/database.ts` - Singleton Azure SQL connection pool with dual auth mode
- `api/src/models/Vehicle.ts` - VehicleInputSchema, VehicleStatusSchema, IVehicle, IVehicleFilters
- `api/src/models/Category.ts` - CategoryInputSchema, ICategory
- `api/src/models/Location.ts` - ILocation, ILocationSyncResult
- `api/src/models/UserContext.ts` - AppRole updated with SuperAdmin, officeLocation field added
- `api/src/middleware/auth.ts` - ROLE_HIERARCHY updated, resolveEffectiveRole checks SuperAdmin first
- `api/local.settings.json` - Azure SQL environment variable placeholders added
- `api/package.json` - mssql, @azure/identity, @types/mssql dependencies added
- `spfx/src/webparts/rentaVehicle/models/IUser.ts` - AppRole and ROLE_HIERARCHY updated with SuperAdmin
- `spfx/src/webparts/rentaVehicle/components/Sidebar/Sidebar.tsx` - ROLE_COLORS updated with SuperAdmin
- `spfx/src/webparts/rentaVehicle/components/Sidebar/Sidebar.module.scss` - roleSuperAdmin style added
- `spfx/src/webparts/rentaVehicle/styles/variables.module.scss` - $color-role-superadmin variable added

## Decisions Made
- **Azure AD auth config requires explicit options object**: The `@types/mssql` type definitions for `AzureActiveDirectoryDefaultAuthentication` require an `options` property (with optional `clientId`), even though the `mssql` runtime accepts the config without it. Set `clientId: undefined` to satisfy the type checker.
- **SuperAdmin badge color is purple (#881798)**: Chose a distinct color from Admin's orange (#d83b01) to make the elevated privilege visually obvious. Purple is from the Fluent UI color palette.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AzureActiveDirectoryDefault authentication type config**
- **Found during:** Task 1 (database connection pool)
- **Issue:** The `authentication` config for `azure-active-directory-default` was cast with `as sql.config['authentication']['type']` but the type definition requires an `options` object with a `clientId` property. TypeScript compilation failed.
- **Fix:** Changed to explicit type literal `'azure-active-directory-default'` with `options: { clientId: undefined }` to match the `AzureActiveDirectoryDefaultAuthentication` interface.
- **Files modified:** `api/src/services/database.ts`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `cdc469b` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed SPFx Sidebar ROLE_COLORS missing SuperAdmin entry**
- **Found during:** Task 2 (SuperAdmin role addition)
- **Issue:** After updating the `AppRole` type to include `SuperAdmin`, the `Record<AppRole, string>` in `Sidebar.tsx` was missing the new key, causing TypeScript error TS2741.
- **Fix:** Added `SuperAdmin: styles.roleSuperAdmin` to the ROLE_COLORS record, added `.roleSuperAdmin` SCSS class with `$color-role-superadmin` variable.
- **Files modified:** `Sidebar.tsx`, `Sidebar.module.scss`, `variables.module.scss`
- **Verification:** `npx heft build --clean` compiles clean
- **Committed in:** `3edd50f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

Azure SQL database must be configured before the connection pool can be used. Environment variables to set in `api/local.settings.json`:
- `AZURE_SQL_SERVER` - Azure SQL Server hostname (e.g., myserver.database.windows.net)
- `AZURE_SQL_DATABASE` - Database name
- `AZURE_SQL_PORT` - Default 1433
- `AZURE_SQL_USER` - SQL Server admin username (local dev)
- `AZURE_SQL_PASSWORD` - SQL Server admin password (local dev)

Run `api/src/sql/schema.sql` against the database to create tables and indexes.

## Next Phase Readiness
- Database layer complete: connection pool, schema, all TypeScript models with validation
- Ready for Plan 02 (CRUD API endpoints) to build vehicle, category, and location services
- SuperAdmin role integrated across both projects -- ready for location-scoped authorization logic
- Both projects compile clean with zero TypeScript errors

## Self-Check: PASSED

All 10 key files exist. Both task commits (cdc469b, 3edd50f) verified in git log. SUMMARY.md exists.

---
*Phase: 02-vehicle-inventory-and-locations*
*Completed: 2026-02-23*
