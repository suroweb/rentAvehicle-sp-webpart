# Phase 11: CI/CD and Infrastructure - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic CI validation on push/PR via GitHub Actions, and Bicep IaC templates that provision Azure Functions App, Azure SQL, App Service Plan with Entra ID Easy Auth. No CD (continuous deployment) — deployment is manual from artifacts and Bicep CLI.

</domain>

<decisions>
## Implementation Decisions

### CI pipeline
- Trigger on PR and push to main branch
- Single workflow file with two parallel jobs: SPFx build and API build
- SPFx job: `heft test --clean --production && heft package-solution --production`
- API job: `tsc` (standard TypeScript compile)
- Both jobs run ESLint + TypeScript type checking (lint + type-check only, no unit tests)
- Upload `.sppkg` artifact on main branch builds only (not on PRs)
- Node.js 22.x (matches engines constraint in spfx/package.json)

### Bicep template structure
- Modular layout: `main.bicep` orchestrator calling separate modules per resource
- Modules: Function App, App Service Plan, Azure SQL (server + database)
- Files live in `infra/` folder at repo root
- Parameter file (`main.bicepparam`) with non-secret defaults (SKU, region, naming prefix)
- Secrets use `@secure()` decorator — provided at deploy time via CLI or GitHub Actions secrets, never stored in repo

### Entra ID / Easy Auth
- Bicep configures Easy Auth on the Function App only — app registration is a manual prerequisite
- Parameters: existing app registration client ID and tenant ID passed as Bicep params
- Auth required on all routes (no anonymous endpoints)
- All Function App application settings configured in Bicep: SQL connection string, Azure tenant/client IDs, client secret, notification sender email, Teams app ID, app base URL
- CORS configured in Bicep with SharePoint tenant origin as allowed origin (passed as parameter)

### Environment strategy
- Single production environment only
- One parameter file with production values

### Claude's Discretion
- Azure resource naming convention (consistent scheme)
- SKU tiers (cost-effective for portfolio/internal project with low traffic)
- Default Azure region (European)
- Exact ESLint configuration for CI (use existing project ESLint configs)
- Whether to include a health check endpoint exception from auth

</decisions>

<specifics>
## Specific Ideas

- The SPFx build uses Heft (not Gulp) — SPFx 1.22 toolchain
- API uses Azure Functions v4 with Node.js runtime
- `local.settings.template.json` documents the full set of required app settings
- `package-solution.json` shows the web part requests `user_impersonation` scope on `RentAVehicle-API` resource
- The `.sppkg` output path is `solution/renta-vehicle.sppkg`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/local.settings.template.json`: Documents all required app settings (SQL, Graph, Teams, notifications) — use as reference for Bicep app settings configuration
- `spfx/config/package-solution.json`: Contains solution ID, version, web API permission requests
- `api/host.json`: Azure Functions host configuration with extension bundle v4
- `scripts/sync-dev-config.js`: Shows the config sync pattern used locally

### Established Patterns
- SPFx build: `heft test --clean --production && heft package-solution --production` (from package.json scripts)
- API build: `tsc` (simple TypeScript compilation, from package.json scripts)
- API depends on: `@azure/functions` v4, `@azure/identity`, `mssql`, `@microsoft/microsoft-graph-client`, `zod`
- SPFx depends on: `@fluentui/react`, `@fluentui/react-charting`, SPFx 1.22.2 framework packages

### Integration Points
- Function App needs `user_impersonation` scope exposed for SPFx to call it
- Easy Auth validates the bearer token the SPFx web part sends
- SQL connection uses `mssql` package — connection string params: server, database, port, user, password
- Graph API needs tenant ID, client ID, client secret for service-to-service calls

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ci-cd-and-infrastructure*
*Context gathered: 2026-03-01*
