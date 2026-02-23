---
phase: 01-foundation-and-authentication
plan: 01
subsystem: auth, api, ui
tags: [spfx, azure-functions, entra-id, rbac, aad-http-client, easy-auth, zod, heft, react-17, typescript]

# Dependency graph
requires:
  - phase: none
    provides: first plan - no dependencies
provides:
  - SPFx project scaffold with Heft build, React 17.0.1, Teams support
  - Azure Functions v4 API project with TypeScript
  - Auth middleware (parseClientPrincipal, requireRole, getUserFromRequest)
  - UserContext model with AppRole type hierarchy
  - Three API endpoints (health, me, backoffice/health)
  - Local dev mock authentication via environment variables
  - AadHttpClient initialization in webpart entry point
  - webApiPermissionRequests in package-solution.json
affects: [01-02-PLAN, 01-03-PLAN, all subsequent API plans]

# Tech tracking
tech-stack:
  added: ["@microsoft/generator-sharepoint@1.22.2", "react@17.0.1", "react-dom@17.0.1", "@azure/functions@4.11.2", "zod@3.x", "typescript@5.8"]
  patterns: ["x-ms-client-principal header parsing", "role hierarchy resolution (Admin > Manager > Employee)", "local dev mock via env vars", "AadHttpClient for SPFx-to-API auth"]

key-files:
  created:
    - spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts
    - spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.manifest.json
    - spfx/config/package-solution.json
    - api/src/models/UserContext.ts
    - api/src/middleware/auth.ts
    - api/src/functions/health.ts
    - api/src/functions/me.ts
    - api/src/index.ts
    - api/package.json
    - api/tsconfig.json
    - api/host.json
    - api/local.settings.json
  modified: []

key-decisions:
  - "Route uses 'backoffice/health' instead of 'admin/health' because Azure Functions reserves the /admin route prefix for built-in management APIs"
  - "index.ts explicitly imports function modules (auto-discovery does not work in Azure Functions v4 Node.js programming model)"
  - "local.settings.json tracked in git since it contains only dev mock config, not secrets"

patterns-established:
  - "Pattern: x-ms-client-principal header parsing with zod validation for type safety"
  - "Pattern: getUserFromRequest() with local dev mock fallback"
  - "Pattern: requireRole() curried function for role-based access control"
  - "Pattern: All endpoints use authLevel anonymous (Easy Auth handles token validation at platform level)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 16min
completed: 2026-02-23
---

# Phase 1 Plan 1: Scaffold and Auth Middleware Summary

**SPFx 1.22 + Azure Functions v4 project scaffold with x-ms-client-principal auth middleware, role hierarchy (Admin > Manager > Employee), and three working API endpoints**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-22T23:59:02Z
- **Completed:** 2026-02-23T00:15:48Z
- **Tasks:** 2
- **Files modified:** 40

## Accomplishments
- SPFx 1.22.2 project scaffolded with Heft build toolchain, React 17.0.1 pinned, Teams + SharePoint host support
- Azure Functions v4 project with TypeScript, three working endpoints (health, me, backoffice/health)
- Auth middleware parses x-ms-client-principal header, validates with zod, resolves role hierarchy
- Role enforcement verified: Employee gets 403 on admin endpoint, Admin gets 200, Manager gets 403
- Local development mock enables testing without deployed Easy Auth
- Webpart entry point initializes AadHttpClient for authenticated API calls to Azure Functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold SPFx and Azure Functions projects** - `953c58d` (feat)
2. **Task 2: Implement auth middleware and API endpoints** - `856f3d0` (feat)

## Files Created/Modified
- `spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts` - Webpart entry point with AadHttpClient initialization and Teams detection
- `spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.manifest.json` - Manifest with SharePoint + Teams hosts, RentAVehicle title
- `spfx/src/webparts/rentaVehicle/components/IRentaVehicleProps.ts` - Props interface with apiClient, isTeams, userEmail, supportContact
- `spfx/src/webparts/rentaVehicle/components/RentaVehicle.tsx` - Placeholder component for app shell
- `spfx/config/package-solution.json` - Solution config with webApiPermissionRequests for user_impersonation
- `api/src/models/UserContext.ts` - UserContext interface with AppRole type and effectiveRole
- `api/src/middleware/auth.ts` - parseClientPrincipal, requireRole, getUserFromRequest, getLocalDevUser
- `api/src/functions/health.ts` - GET /api/health (public) and GET /api/backoffice/health (admin-only)
- `api/src/functions/me.ts` - GET /api/me returning user identity and role
- `api/src/index.ts` - Entry point importing function modules
- `api/package.json` - Azure Functions v4 with zod, TypeScript
- `api/tsconfig.json` - TypeScript config targeting ES2022, Node16 module resolution
- `api/host.json` - Functions host config with extension bundle
- `api/local.settings.json` - Local dev settings with mock user (Admin role)
- `api/.gitignore` - Excludes node_modules/ and dist/

## Decisions Made
- **Route prefix changed from 'admin' to 'backoffice'**: Azure Functions Core Tools and the runtime reserve the `/admin` route prefix for built-in management APIs. Any route starting with `admin` (including `administration`) conflicts. Changed to `backoffice/health` which preserves the intent while avoiding the conflict.
- **Explicit function imports in index.ts**: Azure Functions v4 Node.js programming model does not auto-discover function files. The entry point must explicitly import all function registration modules.
- **local.settings.json tracked in git**: Contains only local dev mock configuration, not real secrets. Enables team members to start developing immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Azure Functions /admin route prefix conflict**
- **Found during:** Task 2 (API endpoint implementation)
- **Issue:** Plan specified `GET /api/admin/health` route, but Azure Functions reserves the `/admin` prefix for built-in management APIs. The function fails to register with error "The specified route conflicts with one or more built in routes."
- **Fix:** Changed route from `admin/health` to `backoffice/health`. The `administration/health` prefix also conflicted (likely regex match on `admin*`).
- **Files modified:** `api/src/functions/health.ts`
- **Verification:** Function registers successfully, all three endpoints respond correctly
- **Committed in:** `856f3d0` (Task 2 commit)

**2. [Rule 3 - Blocking] Function auto-discovery does not work in Azure Functions v4**
- **Found during:** Task 2 (API endpoint implementation)
- **Issue:** The plan stated "function files are auto-discovered by the runtime" but `func start` showed "No job functions found" until function modules were explicitly imported.
- **Fix:** Updated `api/src/index.ts` to import `./functions/health.js` and `./functions/me.js`
- **Files modified:** `api/src/index.ts`
- **Verification:** `func start` now lists all three endpoints
- **Committed in:** `856f3d0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for the API to function. Route rename is semantic only (backoffice vs admin). No scope creep.

## Issues Encountered
- SPFx generator 1.22.2 could not be installed globally due to EACCES permissions on /opt/homebrew/lib. Resolved by installing locally in a temp directory and running via npx with the correct NODE_PATH.
- The Yeoman generator creates a subfolder with the solution name inside the target directory. Had to move files up to the spfx/ directory after scaffolding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SPFx project ready for Plan 02 (AppShell, AuthContext, sidebar, bottom tab bar, welcome screen)
- Azure Functions API ready for Plan 03 (integration verification)
- Auth middleware pattern established for all future API endpoints
- AadHttpClient placeholder (`api://<azure-functions-app-client-id>`) needs real client ID when Entra ID app registration is configured

## Self-Check: PASSED

All 12 key files exist. Both task commits (953c58d, 856f3d0) verified in git log. SUMMARY.md exists.

---
*Phase: 01-foundation-and-authentication*
*Completed: 2026-02-23*
