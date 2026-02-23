---
phase: 02-vehicle-inventory-and-locations
verified: 2026-02-23T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Add a new vehicle with all 8 fields and confirm it appears in the fleet list"
    expected: "Vehicle form submits, POST /api/backoffice/vehicles is called, new vehicle row appears in the DetailsList table with all details including the photo thumbnail"
    why_human: "Requires live Azure SQL + API running. Cannot verify round-trip data persistence or list refresh programmatically."
  - test: "Edit an existing vehicle's details and confirm the changes are reflected immediately in the fleet list"
    expected: "Edit action opens VehicleForm pre-populated with current values, PUT /api/backoffice/vehicles/{id} is called on save, updated row appears in the table without manual refresh"
    why_human: "Requires live backend to confirm the update roundtrip and that fetchVehicles() correctly re-renders."
  - test: "Remove a vehicle using the three-dot menu and confirm it disappears from the fleet list"
    expected: "Remove option shows ConfirmDialog, on confirm calls DELETE /api/backoffice/vehicles/{id} which sets isArchived=1, vehicle row disappears from the table"
    why_human: "Requires live backend to verify the soft delete and list refresh."
  - test: "Change a vehicle status to 'In Maintenance' and verify it would be excluded from employee browsing"
    expected: "Two-step dialog appears, status is updated via PATCH /api/backoffice/vehicles/{id}/status, vehicle status badge changes to yellow 'In Maintenance'. The API getVehicles with status=Available filter would exclude it."
    why_human: "Employee browsing UI is Phase 3. Can only verify the status field updates correctly; the actual exclusion from employee browsing requires Phase 3 to be built. The data model and status filter are verified in code."
  - test: "Navigate to Locations page and confirm office locations from Entra ID appear without manual entry"
    expected: "LocationList page loads, ensureLocationsSynced() triggers Graph API call, locations populated from Entra ID officeLocation field appear in the DetailsList with vehicle counts"
    why_human: "Requires Azure Entra ID tenant, AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET configured, and User.Read.All permission granted. Cannot verify without live credentials."
  - test: "Verify SuperAdmin-only Sync button triggers a fresh Entra ID sync and displays result count"
    expected: "Sync Locations button is visible only when userRole === 'SuperAdmin', clicking it calls POST /api/backoffice/locations/sync, a MessageBar shows 'Sync complete -- Added: X, Deactivated: Y, Total: Z'"
    why_human: "Requires live Entra ID credentials and a SuperAdmin user session to test the role gate."
---

# Phase 2: Vehicle Inventory and Locations Verification Report

**Phase Goal:** Fleet admins can manage the complete vehicle inventory and company locations are automatically synced from the corporate directory
**Verified:** 2026-02-23
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can add a new vehicle with all details (make, model, year, plate, location, category, capacity, photo) and it appears in the fleet list | VERIFIED (code) / ? human (runtime) | `VehicleForm.tsx` has all 8 fields with validation; `handleSubmit` calls `apiService.createVehicle()`; `POST backoffice/vehicles` endpoint calls `createVehicle()` in `vehicleService.ts` which does `INSERT INTO Vehicles`; on save `FleetManagement.tsx` calls `fetchVehicles()` |
| 2 | Admin can edit any vehicle's details and the changes are reflected immediately | VERIFIED (code) / ? human (runtime) | `VehicleForm.tsx` pre-populates from `vehicle` prop; `handleSubmit` branches to `apiService.updateVehicle()`; `PUT backoffice/vehicles/{id}` calls `updateVehicle()` which does `UPDATE Vehicles WHERE id=@id AND isArchived=0`; on save `FleetManagement.tsx` calls `fetchVehicles()` |
| 3 | Admin can remove a vehicle from the fleet | VERIFIED (code) / ? human (runtime) | `handleRemove` in `FleetManagement.tsx` shows `ConfirmDialog`, on confirm calls `apiService.deleteVehicle()`; `DELETE backoffice/vehicles/{id}` calls `archiveVehicle()` which sets `isArchived=1, archivedAt=GETUTCDATE()` -- never deletes; list refresh via `fetchVehicles()` confirmed |
| 4 | Admin can change status to "in maintenance" or "retired" and that vehicle no longer appears when employees browse | VERIFIED (code) / ? human (runtime) | Two-step status dialog in `FleetManagement.tsx`; `PATCH backoffice/vehicles/{id}/status` calls `updateVehicleStatus()`; `VehicleStatusSchema` accepts `Available\|InMaintenance\|Retired`; `getVehicles` accepts `status` filter param; employee-facing exclusion enforced in Phase 3 query with `status=Available` (by design, per RESEARCH.md) |
| 5 | Company office locations from Entra ID are available as selectable locations without manual entry | VERIFIED (code) / ? human (runtime) | `graphService.ts` paginates `/users?$select=officeLocation`; `locationService.ts` `syncLocations()` upserts new, deactivates removed, reactivates returned; `ensureLocationsSynced()` auto-triggers on first GET /backoffice/locations if stale >24h; `LocationList.tsx` shows sync button for SuperAdmin; `VehicleForm.tsx` dropdown populated from `apiService.getLocations()` |

**Score:** 5/5 truths verified in code. Runtime verification requires human testing with live Azure infrastructure.

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | min_lines | Lines | Contains / Exports | Status |
|----------|-----------|-------|-------------------|--------|
| `api/src/sql/schema.sql` | -- | 50 | `CREATE TABLE Vehicles`, `CREATE TABLE Categories`, `CREATE TABLE Locations`, 4 indexes | VERIFIED |
| `api/src/services/database.ts` | -- | 69 | exports `getPool`, dual auth (SQL/Azure AD), singleton pool | VERIFIED |
| `api/src/models/Vehicle.ts` | -- | 65 | exports `VehicleInputSchema`, `VehicleStatusSchema`, `IVehicle`, `IVehicleFilters` | VERIFIED |
| `api/src/models/Category.ts` | -- | -- | exports `CategoryInputSchema`, `ICategory` | VERIFIED |
| `api/src/models/Location.ts` | -- | -- | exports `ILocation`, `ILocationSyncResult` | VERIFIED |
| `api/src/models/UserContext.ts` | -- | 24 | `AppRole` includes `SuperAdmin`, `officeLocation` field | VERIFIED |
| `api/src/middleware/auth.ts` | -- | 152 | `ROLE_HIERARCHY` has `SuperAdmin: 3`, `resolveEffectiveRole` checks SuperAdmin first | VERIFIED |
| `spfx/src/webparts/rentaVehicle/models/IUser.ts` | -- | 19 | `AppRole` includes `SuperAdmin`, `ROLE_HIERARCHY` has `SuperAdmin: 3` | VERIFIED |

#### Plan 02 Artifacts

| Artifact | Lines | Contains / Exports | Status |
|----------|-------|-------------------|--------|
| `api/src/services/vehicleService.ts` | 224 | exports all 7 functions: `resolveLocationIdForAdmin`, `getVehicles`, `getVehicleById`, `createVehicle`, `updateVehicle`, `archiveVehicle`, `updateVehicleStatus` | VERIFIED |
| `api/src/services/categoryService.ts` | -- | exports `getCategories`, `createCategory`, `updateCategory`, `archiveCategory` | VERIFIED |
| `api/src/services/locationService.ts` | 161 | exports `getLocationsWithVehicleCounts`, `syncLocations`, `ensureLocationsSynced` | VERIFIED |
| `api/src/services/graphService.ts` | 87 | exports `getDistinctOfficeLocations`, `Client.init` pattern, pagination via `@odata.nextLink` | VERIFIED |
| `api/src/functions/vehicles.ts` | 384 | 6 `app.http()` registrations under `backoffice/vehicles`, all require Admin/SuperAdmin | VERIFIED |
| `api/src/functions/categories.ts` | 225 | 4 `app.http()` registrations under `backoffice/categories` | VERIFIED |
| `api/src/functions/locations.ts` | 118 | 2 `app.http()` registrations: GET lazy-sync + POST manual sync (SuperAdmin only) | VERIFIED |
| `api/src/index.ts` | 7 | imports `vehicles.js`, `categories.js`, `locations.js` | VERIFIED |

#### Plan 03 Artifacts

| Artifact | min_lines | Actual Lines | Status |
|----------|-----------|-------------|--------|
| `spfx/.../FleetManagement/FleetManagement.tsx` | 50 | 367 | VERIFIED |
| `spfx/.../FleetManagement/VehicleTable.tsx` | 80 | 198 | VERIFIED |
| `spfx/.../FleetManagement/VehicleFilterBar.tsx` | 40 | 140 | VERIFIED |
| `spfx/.../FleetManagement/StatusBadge.tsx` | 20 | 38 | VERIFIED |
| `spfx/.../ConfirmDialog/ConfirmDialog.tsx` | 30 | 56 | VERIFIED |
| `spfx/.../services/ApiService.ts` | -- | 219 | contains `getVehicles`, all 13 CRUD methods | VERIFIED |
| `spfx/.../AppShell/AppShell.tsx` | -- | 167 | contains `FleetManagement`, routes on `activeNavKey` | VERIFIED |

#### Plan 04 Artifacts

| Artifact | min_lines | Actual Lines | Status |
|----------|-----------|-------------|--------|
| `spfx/.../VehicleForm/VehicleForm.tsx` | 100 | 390 | VERIFIED |
| `spfx/.../VehicleForm/PhotoUpload.tsx` | 40 | 160 | VERIFIED |
| `spfx/.../CategoryManagement/CategoryManagement.tsx` | 60 | 457 | VERIFIED |
| `spfx/.../LocationList/LocationList.tsx` | 50 | 246 | VERIFIED |

---

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `api/src/services/database.ts` | `process.env.AZURE_SQL_*` | `AZURE_SQL_SERVER` read at line 27 | WIRED |
| `api/src/models/Vehicle.ts` | `api/src/sql/schema.sql` | TypeScript `licensePlate: string` mirrors SQL `licensePlate NVARCHAR(20)` | WIRED |
| `api/src/middleware/auth.ts` | `api/src/models/UserContext.ts` | `import { UserContext, AppRole } from '../models/UserContext.js'` at line 3 | WIRED |

#### Plan 02 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `api/src/functions/vehicles.ts` | `api/src/services/vehicleService.ts` | `import { resolveLocationIdForAdmin, getVehicles, ... } from '../services/vehicleService.js'` lines 24-31 | WIRED |
| `api/src/functions/vehicles.ts` | `api/src/middleware/auth.ts` | `import { getUserFromRequest, requireRole } from '../middleware/auth.js'` line 22 | WIRED |
| `api/src/services/vehicleService.ts` | `api/src/services/database.ts` | `import { getPool } from './database.js'` line 8 | WIRED |
| `api/src/services/graphService.ts` | `@microsoft/microsoft-graph-client` | `import { Client } from '@microsoft/microsoft-graph-client'` line 12; `Client.init(...)` line 47 | WIRED |
| `api/src/services/locationService.ts` | `api/src/services/database.ts` | `import { getPool } from './database.js'` line 8 | WIRED |

#### Plan 03 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `FleetManagement.tsx` | `ApiService.ts` | `apiService.getVehicles(currentFilters)` line 85; `apiService.getCategories()` line 105; `apiService.getLocations()` line 106 | WIRED |
| `VehicleTable.tsx` | `StatusBadge.tsx` | `import { StatusBadge } from './StatusBadge'` line 11; `<StatusBadge status={item.status} />` line 168 | WIRED |
| `AppShell.tsx` | `FleetManagement.tsx` | `import { FleetManagement } from '../FleetManagement/FleetManagement'` line 10; `case 'vehicles': return <FleetManagement apiService={apiService} />` lines 53-55 | WIRED |
| `FleetManagement.tsx` | `ConfirmDialog.tsx` | `import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'` line 18; `<ConfirmDialog ... />` line 337 | WIRED |

#### Plan 04 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `VehicleForm.tsx` | `ApiService.ts` | `apiService.updateVehicle(vehicle.id, input)` line 230; `apiService.createVehicle(input)` line 232 | WIRED |
| `FleetManagement.tsx` | `VehicleForm.tsx` | `import { VehicleForm } from '../VehicleForm/VehicleForm'` line 19; `<VehicleForm apiService={...} ... />` lines 264-272 | WIRED |
| `LocationList.tsx` | `ApiService.ts` | `apiService.syncLocations()` line 61; `apiService.getLocations()` line 31 | WIRED |
| `AppShell.tsx` | `LocationList.tsx` | `import { LocationList } from '../LocationList/LocationList'` line 12; `case 'locations': return <LocationList ... />` lines 72-74 | WIRED |
| `AppShell.tsx` | `CategoryManagement.tsx` | `import { CategoryManagement } from '../CategoryManagement/CategoryManagement'` line 11; `case 'categories': return <CategoryManagement ... />` lines 63-65 | WIRED |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VHCL-01 | 02-01, 02-02, 02-03, 02-04 | Admin can add a new vehicle (make, model, year, license plate, location, category, capacity, photo) | SATISFIED | `VehicleForm.tsx` has all 8 fields; `POST backoffice/vehicles` endpoint; `createVehicle()` inserts into DB |
| VHCL-02 | 02-01, 02-02, 02-03, 02-04 | Admin can edit vehicle details | SATISFIED | `VehicleForm.tsx` edit mode pre-populates; `PUT backoffice/vehicles/{id}` endpoint; `updateVehicle()` updates DB |
| VHCL-03 | 02-02, 02-03 | Admin can remove a vehicle from the fleet | SATISFIED | `DELETE backoffice/vehicles/{id}` calls `archiveVehicle()` setting `isArchived=1`; `handleRemove` in `FleetManagement.tsx` calls `apiService.deleteVehicle()` |
| VHCL-04 | 02-02, 02-03 | Admin can set vehicle status (available, in maintenance, retired) | SATISFIED | `PATCH backoffice/vehicles/{id}/status`; `VehicleStatusSchema` validates `Available\|InMaintenance\|Retired`; two-step UI dialog in `FleetManagement.tsx` |
| VHCL-05 | 02-01, 02-02 | Vehicles not in "available" status are excluded from employee browsing | SATISFIED (data model) / ? human (Phase 3 UI) | `VehicleStatusSchema` enforces valid statuses; `getVehicles` accepts `status` filter param; API `status` column with CHECK constraint in schema; employee-facing `status=Available AND isArchived=0` filter is per design in Phase 3 (per RESEARCH.md: "SQL WHERE clause `status = 'Available' AND isArchived = 0` on employee-facing queries (Phase 3)") |
| M365-04 | 02-02 | Locations synced from Entra ID (officeLocation or organizational data) | SATISFIED | `graphService.ts` paginates Graph API `/users?$select=officeLocation`; `syncLocations()` upserts all 3 states (add/deactivate/reactivate); `ensureLocationsSynced()` lazy-sync on GET /backoffice/locations |

No orphaned requirements found. All 6 Phase 2 requirement IDs declared across plans are accounted for and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `spfx/.../services/ApiService.ts` | 7-8 | `// Placeholder: replace with the real Azure Functions app URL once deployed` — `API_BASE_URL = 'https://rentavehicle-api.azurewebsites.net'` | INFO | Hardcoded URL is a deployment configuration concern, not a code defect. Constructor accepts `baseUrl?` override. Will not function in local development without SPFx property bag or environment config override. |
| `spfx/.../VehicleForm/PhotoUpload.tsx` | 13-16 | `// TODO: For production, replace base64 data URL storage with Azure Blob Storage` | INFO | Intentional known deferral documented in RESEARCH.md open question 3 and SUMMARY decision log. Base64 approach is functional for Phase 2. |
| `spfx/.../AppShell/AppShell.tsx` | 83 | `"Coming Soon"` for unrecognized nav keys | INFO | Default case for future nav items (browse, myBookings, etc.) not yet implemented. Expected for Phase 2. |

No blockers found. No FIXME or critical stubs detected.

---

### Human Verification Required

All automated code-level checks pass. The following items require a live Azure environment with SQL + Entra ID credentials to verify end-to-end:

#### 1. Vehicle Add Roundtrip

**Test:** Log in as Admin, navigate to Manage Vehicles, click Add Vehicle, fill all 8 fields (including photo), and click Create Vehicle.
**Expected:** Vehicle appears in the fleet list table with all columns populated including the photo thumbnail.
**Why human:** Requires live Azure SQL database with schema applied and Azure Functions running.

#### 2. Vehicle Edit Roundtrip

**Test:** Click three-dot menu on an existing vehicle row, choose Edit, change the make/model fields, click Save Changes.
**Expected:** Updated values appear immediately in the fleet list row without page refresh.
**Why human:** Requires live backend and tests the `fetchVehicles()` re-render on save.

#### 3. Vehicle Removal

**Test:** Click three-dot menu, choose Remove. Confirm the dialog.
**Expected:** Vehicle disappears from the table. Confirm row is gone after removal (soft delete).
**Why human:** Requires live backend to confirm `isArchived=1` is set and `getVehicles(isArchived=0)` excludes it.

#### 4. Status Change and Browsing Exclusion

**Test:** Change a vehicle status to "In Maintenance". Verify the status badge turns yellow. Then attempt to browse as an Employee in Phase 3 (when built) with status=Available filter.
**Expected:** Status badge shows yellow "In Maintenance" in the Admin fleet table. Vehicle is absent from employee browsing (Phase 3).
**Why human:** Employee browsing is Phase 3 scope. Phase 2 only verifies the status is stored correctly and the filter mechanism exists in the API.

#### 5. Entra ID Location Sync

**Test:** Configure `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and grant `User.Read.All` application permission. Navigate to Locations as Admin.
**Expected:** Locations page loads and shows office locations from Entra ID without any manual data entry. Last Synced timestamp is recent.
**Why human:** Requires live Entra ID tenant with users who have `officeLocation` set.

#### 6. SuperAdmin Sync Button

**Test:** Log in as SuperAdmin, navigate to Locations, click Sync Locations.
**Expected:** Spinner shows during sync, then a MessageBar displays "Sync complete -- Added: X, Deactivated: Y, Total: Z" with real counts.
**Why human:** Requires SuperAdmin role assignment and live Entra ID credentials.

---

## Summary

**All code-level verification passes.** Every artifact exists, is substantive (no stubs or placeholders in business logic), and is wired correctly:

- The database layer (schema, connection pool, models, zod schemas) is complete and correct.
- All 12 API endpoints (6 vehicles, 4 categories, 2 locations) are registered, authenticated, and call real service functions with parameterized SQL.
- Soft delete is consistently applied (vehicles: `isArchived=1`, categories: `isActive=0`, locations: `isActive=0`).
- Location sync covers all three states (add new, deactivate removed, reactivate returned) with lazy-sync on first access and manual SuperAdmin trigger.
- The SPFx fleet management UI has a full data table with 10 columns, 4-color status badges, location/status/category/search filters, three-dot row action menus, two-step confirmation dialogs, and navigates to a full-page vehicle form for add/edit.
- Category management page has inline add/edit/deactivate. Location list page has vehicle counts, status badges, and SuperAdmin-only sync button.
- AppShell routes correctly to all three admin pages via `activeNavKey` switch.
- All 6 requirement IDs (VHCL-01 through VHCL-05, M365-04) are satisfied by the codebase.

**Gaps:** None that block goal achievement. The `API_BASE_URL` placeholder and base64 photo storage are known, intentional deferrals documented in decision logs.

**Why human_needed:** The phase goal involves live M365 infrastructure (Azure SQL, Entra ID, Graph API). All wiring is present in code but end-to-end behavior cannot be confirmed without running the system.

---

_Verified: 2026-02-23_
_Verifier: Claude (gsd-verifier)_
