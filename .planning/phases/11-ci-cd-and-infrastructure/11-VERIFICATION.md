---
phase: 11-ci-cd-and-infrastructure
verified: 2026-03-01T23:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 11: CI/CD and Infrastructure Verification Report

**Phase Goal:** Code changes are automatically validated by CI, and infrastructure can be provisioned from templates
**Verified:** 2026-03-01T23:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pushing a commit or opening a PR triggers a GitHub Actions workflow that builds the SPFx package and Azure Functions | VERIFIED | `.github/workflows/ci.yml` lines 3-7: triggers on `push: branches: [main]` and `pull_request: branches: [main]`; two jobs `build-spfx` and `build-api` execute in parallel |
| 2 | The CI pipeline fails the build if linting or TypeScript type checking produces errors | VERIFIED | `build-spfx` job runs `npx heft test --clean --production` (includes ESLint); `build-api` job runs `npx tsc --noEmit` then `npx eslint src/`; both commands exit non-zero on errors causing CI failure |
| 3 | Running the Bicep templates provisions an Azure Functions App, Azure SQL database, and App Service Plan | VERIFIED | `infra/main.bicep` calls `module plan 'modules/appServicePlan.bicep'` (Y1 Consumption), `module func 'modules/functionApp.bicep'` (Linux Node 22), `module sql 'modules/sqlServer.bicep'` (Basic tier) with full parameter wiring |
| 4 | The Bicep templates configure Entra ID Easy Auth and required application settings so the deployed app authenticates without manual portal configuration | VERIFIED | `infra/modules/authConfig.bicep` deploys `authsettingsV2` resource with `Return401`, Entra ID provider, `openIdIssuer`, and `allowedAudiences`; `infra/modules/functionApp.bicep` contains all 15 app settings from `local.settings.template.json` |

**Score:** 4/4 Success Criteria from ROADMAP verified

### Plan-level Must-Have Truths (from PLAN frontmatter)

#### Plan 11-01: CI Workflow

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pushing a commit to main triggers a GitHub Actions workflow that builds both SPFx and API | VERIFIED | `on.push.branches: [main]`, both `build-spfx` and `build-api` jobs present |
| 2 | Opening a PR against main triggers the same CI workflow | VERIFIED | `on.pull_request.branches: [main]` confirmed at line 6 |
| 3 | The SPFx job compiles TypeScript, runs ESLint, bundles, and packages the .sppkg | VERIFIED | `npx heft test --clean --production` (runs TypeScript + ESLint via heft's built-in configuration) and `npx heft package-solution --production` are present in `build-spfx` job |
| 4 | The API job compiles TypeScript and runs ESLint | VERIFIED | `npx tsc --noEmit` and `npx eslint src/` both present in `build-api` job |
| 5 | CI fails if ESLint or TypeScript type checking produces errors in either project | VERIFIED | No `continue-on-error` or `|| true` wrappers on lint/tsc steps; default behavior exits on non-zero |
| 6 | The .sppkg artifact is uploaded only on main branch builds | VERIFIED | `if: github.ref == 'refs/heads/main'` on `upload-artifact@v4` step at line 39 |

#### Plan 11-02: Bicep Infrastructure

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the Bicep templates provisions an Azure Functions App on a Consumption plan | VERIFIED | `appServicePlan.bicep`: SKU `Y1 / Dynamic`; `functionApp.bicep`: `kind: 'functionapp,linux'`, `serverFarmId: appServicePlanId` |
| 2 | Running the Bicep templates provisions an Azure SQL Server and Basic-tier database | VERIFIED | `sqlServer.bicep`: `Microsoft.Sql/servers` + `Microsoft.Sql/servers/databases` with `sku: { name: 'Basic', tier: 'Basic' }` |
| 3 | Running the Bicep templates provisions a Storage Account for Function App state | VERIFIED | `storageAccount.bicep`: `Microsoft.Storage/storageAccounts`, `Standard_LRS`; connection string output wired into `functionApp.bicep` `AzureWebJobsStorage` setting |
| 4 | The Bicep templates configure Entra ID Easy Auth with Return401 for unauthenticated requests | VERIFIED | `authConfig.bicep`: `unauthenticatedClientAction: 'Return401'`, `requireAuthentication: true`, Entra ID `azureActiveDirectory` provider with `openIdIssuer` and `allowedAudiences` |
| 5 | All application settings from local.settings.template.json are configured in the Function App | VERIFIED | `functionApp.bicep` contains all 15 settings: `FUNCTIONS_EXTENSION_VERSION`, `FUNCTIONS_WORKER_RUNTIME`, `WEBSITE_NODE_DEFAULT_VERSION`, `AzureWebJobsStorage`, `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_PORT`, `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `NOTIFICATION_SENDER_EMAIL`, `TEAMS_APP_ID`, `APP_BASE_URL` |
| 6 | CORS is configured with the SharePoint tenant origin | VERIFIED | `functionApp.bicep` lines 66-70: `cors.allowedOrigins: [sharepointOrigin]`, `supportCredentials: false` |
| 7 | Secrets are passed via @secure() parameters, never stored in template files | VERIFIED | `@secure()` on `sqlPassword` and `azureClientSecret` in `functionApp.bicep`; `@secure()` on `adminPassword` in `sqlServer.bicep`; `@secure()` on both `sqlAdminPassword` and `azureClientSecret` in `main.bicep`; `main.bicepparam` contains only non-secret defaults (location, prefix, sqlAdminLogin, sqlDatabase, sqlPort) |

---

## Required Artifacts

### Plan 11-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | CI workflow with two parallel jobs | VERIFIED | 60 lines; `build-spfx` and `build-api` jobs with no `needs` dependency between them |
| `api/.eslintrc.json` | ESLint configuration for API project | VERIFIED | 19 lines; `@typescript-eslint/parser`, `eslint:recommended`, `plugin:@typescript-eslint/recommended`, three explicit rules |
| `api/package.json` | ESLint devDependencies for API | VERIFIED | Contains `eslint: ^8.57.1`, `@typescript-eslint/parser: ^7.18.0`, `@typescript-eslint/eslint-plugin: ^7.18.0` |

### Plan 11-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/main.bicep` | Orchestrator calling all resource modules | VERIFIED | 126 lines; calls 5 modules: `plan`, `storage`, `sql`, `func`, `auth` with full parameter wiring and two outputs |
| `infra/main.bicepparam` | Parameter file with non-secret defaults | VERIFIED | 19 lines; `using './main.bicep'` syntax; 5 non-secret params; deploy instructions in comments |
| `infra/modules/appServicePlan.bicep` | Consumption plan (Y1 SKU) | VERIFIED | `Microsoft.Web/serverfarms@2022-03-01`; SKU `Y1 / Dynamic`; `kind: 'functionapp'`; `reserved: true`; outputs `id` |
| `infra/modules/functionApp.bicep` | Function App with all app settings and CORS | VERIFIED | `Microsoft.Web/sites@2022-09-01`; `kind: 'functionapp,linux'`; `linuxFxVersion: 'node\|22'`; 15 app settings; CORS with `sharepointOrigin`; outputs `name` and `defaultHostName` |
| `infra/modules/sqlServer.bicep` | SQL Server + Database + firewall rule | VERIFIED | `Microsoft.Sql/servers`, `Microsoft.Sql/servers/firewallRules` (AllowAllWindowsAzureIps, 0.0.0.0-0.0.0.0), `Microsoft.Sql/servers/databases` (Basic tier); outputs `serverFqdn` and `databaseName` |
| `infra/modules/storageAccount.bicep` | Storage Account for AzureWebJobsStorage | VERIFIED | `Microsoft.Storage/storageAccounts@2022-09-01`; `Standard_LRS`; `StorageV2`; outputs `connectionString` constructed from `listKeys()` |
| `infra/modules/authConfig.bicep` | Easy Auth v2 configuration | VERIFIED | `Microsoft.Web/sites/config@2022-09-01` with `name: 'authsettingsV2'`; references Function App with `existing` keyword; `Return401`; Entra ID identity provider |

---

## Key Link Verification

### Plan 11-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/ci.yml` | `spfx/package.json` | npm ci in spfx working directory | VERIFIED | `working-directory: spfx` at line 15; `- run: npm ci` runs in that context |
| `.github/workflows/ci.yml` | `api/package.json` | npm ci in api working directory | VERIFIED | `working-directory: api` at line 49; `- run: npm ci` runs in that context |
| `.github/workflows/ci.yml` | `spfx/src/config/env.generated.ts` | CI stub generation before heft build | VERIFIED | Step "Generate CI env stub" at line 24-35 creates `src/config/env.generated.ts` (relative to spfx working-directory); `heft test` step follows and will find the stub for TypeScript to resolve |

### Plan 11-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `infra/main.bicep` | `infra/modules/functionApp.bicep` | module call passing appServicePlanId and storageConnectionString | VERIFIED | `module func 'modules/functionApp.bicep'` at line 88; passes `appServicePlanId: plan.outputs.id` and `storageConnectionString: storage.outputs.connectionString` |
| `infra/main.bicep` | `infra/modules/authConfig.bicep` | module call passing functionAppName | VERIFIED | `module auth 'modules/authConfig.bicep'` at line 110; passes `functionAppName: func.outputs.name` creating implicit dependency on `func` |
| `infra/modules/authConfig.bicep` | `infra/modules/functionApp.bicep` | existing resource reference by name | VERIFIED | `resource functionApp 'Microsoft.Web/sites@2022-09-01' existing = { name: functionAppName }` at line 13; auth resource uses `parent: functionApp` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TOOL-01 | 11-01-PLAN.md | GitHub Actions pipeline builds SPFx package and Azure Functions on push/PR | SATISFIED | `ci.yml` triggers on push/PR to main; `build-spfx` runs `heft test + package-solution`; `build-api` runs `tsc + eslint`; commits `104a4ac` and `309239e` verified in git log |
| TOOL-02 | 11-01-PLAN.md | GitHub Actions pipeline runs linting and type checking | SATISFIED | `build-spfx`: `npx heft test` includes ESLint via heft config; `build-api`: `npx tsc --noEmit` + `npx eslint src/`; `api/.eslintrc.json` with `@typescript-eslint/recommended` rules; no `continue-on-error` allows CI to fail on errors |
| TOOL-03 | 11-02-PLAN.md | Bicep templates provision Azure Functions App, Azure SQL, and App Service Plan | SATISFIED | `main.bicep` orchestrates `appServicePlan.bicep` (Y1), `functionApp.bicep` (Linux Node 22), `sqlServer.bicep` (Basic), `storageAccount.bicep` (Standard LRS); commits `21dac19` and `934117d` verified in git log |
| TOOL-04 | 11-02-PLAN.md | Bicep templates configure Entra ID Easy Auth and application settings | SATISFIED | `authConfig.bicep`: `authsettingsV2`, `Return401`, Entra ID provider; `functionApp.bicep`: all 15 app settings including `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`; `@secure()` on secret params |

**Orphaned requirements check:** REQUIREMENTS.md maps TOOL-01, TOOL-02, TOOL-03, TOOL-04 to Phase 11. All four are claimed by the two plans. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.github/workflows/ci.yml` | 27 | `CI_PLACEHOLDER` string in env stub | Info | Intentional — the ENV stub is a compile-time placeholder for CI to satisfy TypeScript imports; not a code stub |

No blockers or warnings found. The only match is a legitimate CI workaround documented in the plan and summary.

---

## Human Verification Required

### 1. CI Workflow Execution on Real GitHub Push

**Test:** Push a commit to the `main` branch (or open a PR against `main`) and observe the GitHub Actions run.
**Expected:** Both `Build SPFx` and `Build API` jobs trigger in parallel; both pass; the `spfx-package` artifact appears in the workflow run artifacts (on main push only).
**Why human:** GitHub Actions execution cannot be verified from the local filesystem. The workflow YAML is syntactically correct and structurally complete, but actual runner behavior (network, npm registry availability, heft version resolution) requires a live CI run.

### 2. CI Fails on Lint/Type Error

**Test:** Introduce a deliberate TypeScript error or ESLint rule violation in either project, push to a branch, and open a PR against main.
**Expected:** The corresponding job (`build-spfx` or `build-api`) fails with a non-zero exit code; the PR is blocked.
**Why human:** Cannot simulate a failing CI run without actually breaking and pushing code.

### 3. Bicep Deployment End-to-End

**Test:** Run `az deployment group create --resource-group <rg> --template-file infra/main.bicep --parameters infra/main.bicepparam --parameters sqlAdminPassword='<value>' azureClientSecret='<value>' entraClientId='<value>' entraTenantId='<value>' notificationSenderEmail='<value>' teamsAppId='<value>' appBaseUrl='<value>' sharepointOrigin='<value>'`
**Expected:** All five Azure resources provisioned (App Service Plan, Storage Account, SQL Server + Database, Function App, Auth Config); Function App rejects unauthenticated requests with HTTP 401; function app settings visible in portal match all 15 expected values.
**Why human:** Bicep template correctness at the ARM API level requires an actual Azure subscription and deployment. Cannot verify resource provisioning from local file inspection.

---

## Summary

Phase 11 has achieved its goal. All 10 plan-level must-have truths are verified, all 4 ROADMAP Success Criteria are satisfied, and all 4 requirements (TOOL-01 through TOOL-04) are fully implemented and evidenced in the codebase.

**CI Pipeline (Plan 11-01):**
- `.github/workflows/ci.yml` is substantive and complete — two parallel jobs, correct triggers, env stub workaround, conditional artifact upload, and both lint+type-check steps are wired without error suppression.
- `api/.eslintrc.json` is a real configuration (not a placeholder) with TypeScript-focused rules.
- `api/package.json` contains pinned ESLint 8.x + `@typescript-eslint` v7 devDependencies.
- All four git commits (`104a4ac`, `309239e`, `21dac19`, `934117d`) are verified present in git log.

**Bicep Infrastructure (Plan 11-02):**
- All seven Bicep files exist and are substantive — each module has typed parameters, a concrete Azure resource declaration, and outputs consumed by `main.bicep`.
- `authConfig.bicep` uses the `existing` resource pattern correctly and wires `authsettingsV2` as a child resource.
- `main.bicepparam` contains only non-secret defaults; secrets are documented as deploy-time CLI parameters.
- The `@secure()` decorator is applied on `sqlAdminPassword` and `azureClientSecret` in both `main.bicep` and the respective modules.

Three human verification items remain — all related to runtime behavior (actual CI execution, failure mode, and live Azure provisioning) that cannot be verified from static file analysis.

---

_Verified: 2026-03-01T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
