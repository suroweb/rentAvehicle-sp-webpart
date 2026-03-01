# Phase 11: CI/CD and Infrastructure - Research

**Researched:** 2026-03-01
**Domain:** GitHub Actions CI pipelines, Azure Bicep IaC (Function App, SQL, Easy Auth)
**Confidence:** HIGH

## Summary

Phase 11 creates two independent deliverables: (1) a GitHub Actions CI workflow that validates SPFx and API builds on push/PR, and (2) Bicep IaC templates that provision Azure Functions, SQL Database, and App Service Plan with Entra ID Easy Auth.

The CI pipeline is straightforward -- two parallel jobs using `npm ci` + existing build commands. The main wrinkle is the SPFx `prebuild` script (`generate-env.js`) that reads local secrets and will fail in CI. The solution is to generate a stub `env.generated.ts` file with placeholder values before the build, since CI only validates compilation, not runtime behavior.

The Bicep templates follow the standard modular pattern: a `main.bicep` orchestrator calling per-resource modules. The `authsettingsV2` resource configures Easy Auth with `Return401` for unauthenticated requests (API-only, no browser redirect). All application settings from `local.settings.template.json` map directly to Bicep `appSettings` entries, with secrets passed via `@secure()` parameters at deploy time.

**Primary recommendation:** Create the GitHub Actions workflow first (instant feedback loop), then the Bicep templates. The `prebuild` problem must be solved by creating a CI-specific stub for `env.generated.ts` so `heft` compilation succeeds without real secrets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Trigger on PR and push to main branch
- Single workflow file with two parallel jobs: SPFx build and API build
- SPFx job: `heft test --clean --production && heft package-solution --production`
- API job: `tsc` (standard TypeScript compile)
- Both jobs run ESLint + TypeScript type checking (lint + type-check only, no unit tests)
- Upload `.sppkg` artifact on main branch builds only (not on PRs)
- Node.js 22.x (matches engines constraint in spfx/package.json)
- Modular layout: `main.bicep` orchestrator calling separate modules per resource
- Modules: Function App, App Service Plan, Azure SQL (server + database)
- Files live in `infra/` folder at repo root
- Parameter file (`main.bicepparam`) with non-secret defaults (SKU, region, naming prefix)
- Secrets use `@secure()` decorator -- provided at deploy time via CLI or GitHub Actions secrets, never stored in repo
- Bicep configures Easy Auth on the Function App only -- app registration is a manual prerequisite
- Parameters: existing app registration client ID and tenant ID passed as Bicep params
- Auth required on all routes (no anonymous endpoints)
- All Function App application settings configured in Bicep: SQL connection string, Azure tenant/client IDs, client secret, notification sender email, Teams app ID, app base URL
- CORS configured in Bicep with SharePoint tenant origin as allowed origin (passed as parameter)
- Single production environment only
- One parameter file with production values

### Claude's Discretion
- Azure resource naming convention (consistent scheme)
- SKU tiers (cost-effective for portfolio/internal project with low traffic)
- Default Azure region (European)
- Exact ESLint configuration for CI (use existing project ESLint configs)
- Whether to include a health check endpoint exception from auth

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOL-01 | GitHub Actions pipeline builds SPFx package and Azure Functions on push/PR | CI workflow with two parallel jobs; SPFx uses `heft test --clean --production && heft package-solution --production`; API uses `tsc`. Stub `env.generated.ts` solves prebuild secret dependency. |
| TOOL-02 | GitHub Actions pipeline runs linting and type checking | SPFx: ESLint runs as part of `heft test` (integrated via `@microsoft/eslint-config-spfx`). API: add `npx eslint .` step (no ESLint config exists yet, must create one). TypeScript type checking happens during build for both. |
| TOOL-03 | Bicep templates provision Azure Functions App, Azure SQL, and App Service Plan | Modular Bicep: `main.bicep` calls `functionApp.bicep`, `appServicePlan.bicep`, `sqlServer.bicep`. Consumption plan (Y1 SKU), Basic DTU SQL ($5/mo), Linux Node.js 22 runtime. |
| TOOL-04 | Bicep templates configure Entra ID Easy Auth and application settings | `authsettingsV2` resource with `Return401` unauthenticatedClientAction, Entra ID identity provider with clientId + openIdIssuer, CORS via siteConfig. All 11 app settings from `local.settings.template.json` configured in Bicep. |

</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | v2 workflow syntax | CI pipeline | Native to GitHub, zero additional tooling |
| Azure Bicep | Latest (CLI bundled with `az`) | Infrastructure as Code | Microsoft's recommended IaC for Azure, supersedes ARM templates |
| actions/checkout | v4 | Git checkout in CI | Official GitHub action, current stable |
| actions/setup-node | v4 | Node.js setup in CI | Official GitHub action, supports Node 22 |
| actions/upload-artifact | v4 | Upload .sppkg build artifact | Official, v3 deprecated as of Jan 2025 |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Heft | 1.1.2 (via SPFx 1.22) | SPFx build orchestration | Already installed, runs ESLint + TypeScript + bundling + packaging |
| ESLint | 8.57.1 (SPFx), new config (API) | Linting | SPFx already configured; API needs a new `.eslintrc.json` |
| TypeScript | ~5.8.0 | Type checking | Both projects already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bicep | ARM templates (JSON) | ARM is verbose and harder to read; Bicep compiles to ARM |
| Bicep | Terraform | Terraform is cross-cloud but adds external state management; Bicep is Azure-native with no state file |
| GitHub Actions | Azure DevOps Pipelines | Azure DevOps is more complex; GitHub Actions is simpler for a repo already on GitHub |

## Architecture Patterns

### Recommended Project Structure
```
.github/
└── workflows/
    └── ci.yml                    # Single workflow, two parallel jobs

infra/
├── main.bicep                    # Orchestrator, calls modules
├── main.bicepparam               # Parameter file with non-secret defaults
└── modules/
    ├── appServicePlan.bicep      # App Service Plan (Consumption Y1)
    ├── functionApp.bicep         # Function App + app settings + CORS
    ├── sqlServer.bicep           # SQL Server + Database
    └── authConfig.bicep          # Easy Auth (authsettingsV2)
```

### Pattern 1: CI Workflow with Parallel Jobs
**What:** Single `.github/workflows/ci.yml` with two jobs that run in parallel.
**When to use:** When SPFx and API are independent build targets.
**Example:**
```yaml
# Source: GitHub Actions docs + SPFx 1.22 CI pattern
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-spfx:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: spfx
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: spfx/package-lock.json
      - run: npm ci
      - name: Generate CI env stub
        run: |
          mkdir -p src/config
          echo "export const ENV = { AZURE_CLIENT_ID: 'CI_PLACEHOLDER', AZURE_TENANT_ID: '', APP_BASE_URL: '', DEV_USER_NAME: '', DEV_USER_EMAIL: '' } as const;" > src/config/env.generated.ts
      - run: npx heft test --clean --production
      - run: npx heft package-solution --production
      - uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: spfx-package
          path: spfx/sharepoint/solution/renta-vehicle.sppkg

  build-api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: api/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint src/
```

### Pattern 2: Bicep Modular Orchestration
**What:** `main.bicep` calls per-resource module files, passing parameters down and receiving outputs up.
**When to use:** Standard pattern for any multi-resource Bicep deployment.
**Example:**
```bicep
// Source: Microsoft Learn - Bicep modules best practices
// infra/main.bicep
param location string = 'westeurope'
param prefix string
@secure()
param sqlAdminPassword string
@secure()
param azureClientSecret string
param entraClientId string
param entraTenantId string
param sharepointOrigin string

module plan 'modules/appServicePlan.bicep' = {
  name: 'appServicePlan'
  params: {
    location: location
    name: '${prefix}-plan'
  }
}

module funcApp 'modules/functionApp.bicep' = {
  name: 'functionApp'
  params: {
    location: location
    name: '${prefix}-func'
    appServicePlanId: plan.outputs.id
    // ... app settings params
  }
}

module sql 'modules/sqlServer.bicep' = {
  name: 'sqlServer'
  params: {
    location: location
    serverName: '${prefix}-sql'
    databaseName: 'RentAVehicle'
    adminPassword: sqlAdminPassword
  }
}

module auth 'modules/authConfig.bicep' = {
  name: 'authConfig'
  params: {
    functionAppName: funcApp.outputs.name
    entraClientId: entraClientId
    entraTenantId: entraTenantId
  }
}
```

### Pattern 3: authsettingsV2 for API-Only Easy Auth
**What:** Configure Easy Auth to return 401 (not redirect) for unauthenticated requests.
**When to use:** When the Function App is an API backend called with bearer tokens (not a browser-facing app).
**Example:**
```bicep
// Source: Microsoft Learn - authsettingsV2 reference
resource authConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          openIdIssuer: 'https://sts.windows.net/${entraTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${entraClientId}'
          ]
        }
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **Hardcoding secrets in Bicep:** Never put connection strings, passwords, or client secrets directly in `.bicep` or `.bicepparam` files. Use `@secure()` parameters provided at deploy time.
- **Single monolithic Bicep file:** A 300+ line single file is hard to review. Split into focused modules.
- **Using authsettings (v1) instead of authsettingsV2:** The v1 resource type is legacy. Always use `authsettingsV2` for new deployments.
- **Skipping `npm ci` in CI:** Using `npm install` in CI can produce non-deterministic builds. Always use `npm ci` with a lockfile.
- **Running `prebuild` scripts that depend on local secrets:** The SPFx `generate-env.js` reads `../../.rentavehicle/secrets.json` which does not exist in CI. Stub the output file instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SPFx build + lint + bundle | Custom webpack/eslint scripts | `heft test --clean --production && heft package-solution --production` | Heft orchestrates ESLint, TypeScript, webpack, and packaging in the correct order |
| Artifact upload in CI | Manual `scp` or API calls | `actions/upload-artifact@v4` | Handles compression, retention, and cross-job access |
| Azure resource provisioning | Portal clicks or `az` CLI scripts | Bicep templates | Declarative, repeatable, diff-able, version-controllable |
| Easy Auth configuration | Manual portal configuration | `authsettingsV2` Bicep resource | Portal config is not reproducible; Bicep captures the full auth state |
| Node.js caching in CI | Manual cache directory management | `actions/setup-node@v4` with `cache: 'npm'` | Built-in npm cache support, handles cache key generation |

**Key insight:** Every manual step becomes a "works on my machine" risk. CI and IaC eliminate that by making every step reproducible from code.

## Common Pitfalls

### Pitfall 1: SPFx prebuild script fails in CI
**What goes wrong:** The `prebuild` script in `spfx/package.json` runs `node tools/generate-env.js`, which reads `../../.rentavehicle/secrets.json`. This file does not exist in CI, causing the build to fail with `process.exit(1)`.
**Why it happens:** The `heft test` command triggers npm lifecycle scripts including `prebuild`.
**How to avoid:** Generate a stub `src/config/env.generated.ts` file BEFORE running heft. The stub exports placeholder strings. Since CI only validates compilation (not runtime), placeholders are sufficient. Run the stub generation step before the heft commands, and heft's `prebuild` will either be skipped or overwritten by the stub.
**Warning signs:** CI fails immediately with "Missing .rentavehicle/secrets.json" error.

**Important detail:** The `prebuild` hook is defined in `package.json` and runs automatically before `npm run build`. In CI, we must NOT run `npm run build` directly (which triggers prebuild). Instead, run `npx heft test --clean --production` and `npx heft package-solution --production` directly, bypassing npm lifecycle scripts. The stub file must be created before these commands since TypeScript compilation needs the import to resolve.

### Pitfall 2: Wrong sppkg artifact path
**What goes wrong:** The `upload-artifact` step points to the wrong path and uploads nothing.
**Why it happens:** SPFx 1.22 outputs to `sharepoint/solution/renta-vehicle.sppkg` (under the SPFx project root), but `package-solution.json` shows `"zippedPackage": "solution/renta-vehicle.sppkg"` which is relative to the `sharepoint` folder.
**How to avoid:** Use path `spfx/sharepoint/solution/renta-vehicle.sppkg` from the repo root.
**Warning signs:** Artifact upload step succeeds but reports 0 files uploaded.

### Pitfall 3: authsettingsV2 resource requires existing Function App
**What goes wrong:** Bicep deployment fails because the auth config module tries to configure a Function App that hasn't been created yet.
**Why it happens:** Missing explicit dependency between the auth config module and the Function App module.
**How to avoid:** Pass the Function App resource name as an output from the functionApp module and use it as input to the authConfig module. Bicep resolves the dependency automatically through the `parent` property when using `existing` reference.
**Warning signs:** Deployment error: "Resource not found" or "Parent resource does not exist."

### Pitfall 4: SQL firewall blocks Function App access
**What goes wrong:** The Function App cannot connect to Azure SQL after deployment.
**Why it happens:** Azure SQL Server has a firewall that blocks all connections by default. Consumption plan Function Apps use dynamic IP addresses.
**How to avoid:** Enable "Allow Azure services and resources to access this server" in the SQL Server firewall rules via Bicep (`allowAllWindowsAzureIps` = true, which creates a firewall rule with start/end IP of `0.0.0.0`).
**Warning signs:** Runtime SQL connection timeouts or "Cannot open server" errors.

### Pitfall 5: CORS origin must not have trailing slash
**What goes wrong:** CORS preflight requests fail with "Origin not allowed" even though the URL looks correct.
**Why it happens:** The SharePoint origin `https://contoso.sharepoint.com` must not have a trailing `/`.
**How to avoid:** Document that the `sharepointOrigin` parameter must be the bare origin without trailing slash.
**Warning signs:** Browser console shows CORS errors; API returns 403 on preflight.

### Pitfall 6: API project has no ESLint configuration
**What goes wrong:** The CI pipeline step `npx eslint src/` fails because there is no `.eslintrc` config in the `api/` directory.
**Why it happens:** The API project was developed without ESLint. The SPFx project has ESLint via `@microsoft/eslint-config-spfx`, but the API project has none.
**How to avoid:** Create an ESLint config for the API project as part of this phase. A minimal TypeScript-focused config is sufficient.
**Warning signs:** `npx eslint src/` exits with "No ESLint configuration found" error.

## Code Examples

### CI Stub for env.generated.ts
```typescript
// Generated by CI pipeline -- placeholder values for compilation only
export const ENV = {
  AZURE_CLIENT_ID: 'CI_PLACEHOLDER',
  AZURE_TENANT_ID: '',
  APP_BASE_URL: '',
  DEV_USER_NAME: '',
  DEV_USER_EMAIL: '',
} as const;
```

### Bicep: Consumption Plan App Service Plan
```bicep
// Source: Microsoft Learn - Azure Functions infrastructure as code
param name string
param location string

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: name
  location: location
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
    capacity: 0
  }
  properties: {
    reserved: true  // Required for Linux
  }
}

output id string = appServicePlan.id
```

### Bicep: Function App with App Settings
```bicep
// Source: Microsoft Learn - Azure Functions Bicep quickstart
param name string
param location string
param appServicePlanId string
param storageAccountConnectionString string
@secure()
param sqlPassword string
@secure()
param azureClientSecret string
param sqlServer string
param sqlDatabase string
param sqlPort string = '1433'
param sqlUser string
param tenantId string
param clientId string
param notificationSenderEmail string
param teamsAppId string
param appBaseUrl string
param sharepointOrigin string

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  kind: 'functionapp,linux'
  properties: {
    reserved: true
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'node|22'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          sharepointOrigin
        ]
        supportCredentials: false
      }
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'AZURE_SQL_SERVER', value: sqlServer }
        { name: 'AZURE_SQL_DATABASE', value: sqlDatabase }
        { name: 'AZURE_SQL_PORT', value: sqlPort }
        { name: 'AZURE_SQL_USER', value: sqlUser }
        { name: 'AZURE_SQL_PASSWORD', value: sqlPassword }
        { name: 'AZURE_TENANT_ID', value: tenantId }
        { name: 'AZURE_CLIENT_ID', value: clientId }
        { name: 'AZURE_CLIENT_SECRET', value: azureClientSecret }
        { name: 'NOTIFICATION_SENDER_EMAIL', value: notificationSenderEmail }
        { name: 'TEAMS_APP_ID', value: teamsAppId }
        { name: 'APP_BASE_URL', value: appBaseUrl }
      ]
    }
  }
}

output name string = functionApp.name
output defaultHostName string = functionApp.properties.defaultHostName
```

### Bicep: Azure SQL Server + Database (Basic tier, ~$5/mo)
```bicep
// Source: Azure quickstart-templates + Microsoft Learn
param serverName string
param databaseName string = 'RentAVehicle'
param location string
param adminLogin string
@secure()
param adminPassword string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: serverName
  location: location
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure services to access
resource firewallRule 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
```

### Bicep: Easy Auth (authsettingsV2)
```bicep
// Source: Microsoft Learn - authsettingsV2 Bicep reference
param functionAppName string
param entraClientId string
param entraTenantId string

resource functionApp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: functionAppName
}

resource authConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          openIdIssuer: 'https://sts.windows.net/${entraTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${entraClientId}'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
    }
  }
}
```

### Bicep Parameter File (main.bicepparam)
```bicep
// Source: Microsoft Learn - Bicep parameter files
using './main.bicep'

param location = 'westeurope'
param prefix = 'rentavehicle'
param sqlAdminLogin = 'sqladmin'
param sqlDatabase = 'RentAVehicle'
param sqlPort = '1433'

// Secrets are NOT stored here -- provided at deploy time:
// az deployment group create \
//   --template-file infra/main.bicep \
//   --parameters infra/main.bicepparam \
//   --parameters sqlAdminPassword='<value>' azureClientSecret='<value>' ...
```

### API ESLint Configuration (new)
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-floating-promises": "error"
  },
  "ignorePatterns": ["dist/", "node_modules/"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gulp-based SPFx builds | Heft-based SPFx builds (SPFx 1.22+) | 2024 | CI must use `heft` commands, not `gulp bundle/package-solution` |
| ARM JSON templates | Azure Bicep | 2021+ (GA) | Bicep is cleaner syntax, compiles to ARM; all new Azure IaC should use Bicep |
| authsettings (v1) | authsettingsV2 | 2021+ | V2 supports multiple providers, finer control, new features |
| actions/upload-artifact@v3 | actions/upload-artifact@v4 | Jan 2025 | v3 deprecated; v4 has 90%+ performance improvements |
| `.json` parameter files | `.bicepparam` files | Bicep 0.18+ (2023) | Native Bicep syntax, type safety from `using` statement |

**Deprecated/outdated:**
- `gulp bundle --ship` / `gulp package-solution --ship`: Replaced by Heft in SPFx 1.22. Do NOT use gulp commands.
- `actions/upload-artifact@v3`: Deprecated Jan 2025. Use v4.
- `authsettings` (v1 resource): Legacy. Use `authsettingsV2`.

## Open Questions

1. **Health check endpoint exception from auth**
   - What we know: Some teams add a `/api/health` endpoint excluded from Easy Auth via `globalValidation.excludedPaths` for monitoring.
   - What's unclear: Whether this project needs it (no monitoring infrastructure is in scope).
   - Recommendation: Skip for now. The `excludedPaths` property is available in authsettingsV2 if needed later. A health check endpoint would also need to be created in the API code, which is out of scope.

2. **Azure Storage Account for Function App**
   - What we know: Azure Functions on Consumption plan require a Storage Account for internal state management (`AzureWebJobsStorage`). The official Bicep quickstart always includes one.
   - What's unclear: The CONTEXT.md lists modules as "Function App, App Service Plan, Azure SQL" -- no Storage Account module mentioned.
   - Recommendation: Add a Storage Account module. It is a hard requirement for Consumption plan Function Apps. Without it, the Function App will not start. This is a small, standard resource (~$0.01/mo) that the planner should include.

3. **Node.js 22 on Azure Functions Linux Consumption**
   - What we know: Azure Functions supports Node.js 22 on Linux Consumption plan. The `linuxFxVersion` should be set to `node|22`.
   - What's unclear: Whether `WEBSITE_NODE_DEFAULT_VERSION` app setting is still needed on Linux (it was historically for Windows).
   - Recommendation: Include `WEBSITE_NODE_DEFAULT_VERSION: '~22'` for safety, and set `linuxFxVersion: 'node|22'` in siteConfig. This is belt-and-suspenders and does no harm.

4. **API ESLint dependencies**
   - What we know: The API project has no ESLint installed. We need `eslint`, `@typescript-eslint/parser`, and `@typescript-eslint/eslint-plugin` as devDependencies.
   - What's unclear: Whether the user wants to add devDependencies to the API project or run ESLint differently.
   - Recommendation: Install minimal ESLint devDependencies in the API project. This is required to satisfy TOOL-02.

## Claude's Discretion Recommendations

### Azure Resource Naming Convention
**Recommendation:** Use `{prefix}-{resource-type}` pattern with a configurable prefix parameter.
- App Service Plan: `{prefix}-plan`
- Function App: `{prefix}-func`
- SQL Server: `{prefix}-sql`
- Storage Account: `{prefix}st` (no hyphens, storage accounts require lowercase alphanumeric only)

Default prefix: `rentavehicle`

**Confidence:** HIGH -- this follows Azure naming conventions guidance.

### SKU Tiers
**Recommendation:**
- App Service Plan: **Consumption (Y1)** -- $0 base cost, pay-per-execution. Perfect for low-traffic portfolio project.
- Azure SQL Database: **Basic tier** -- ~$5/month, 5 DTU, 2GB storage. Sufficient for demo/portfolio use.
- Storage Account: **Standard LRS** -- cheapest redundancy option, ~$0.01/mo for minimal Function App state.

**Confidence:** HIGH -- these are the minimum viable tiers for a working deployment.

### Default Azure Region
**Recommendation:** `westeurope` (Netherlands). Standard European Azure region with full service availability.

**Confidence:** HIGH -- most common European region for Azure.

### ESLint Configuration for CI
**Recommendation:** SPFx already has ESLint configured via `@microsoft/eslint-config-spfx` -- the `heft test` command runs it automatically. For the API, create a new `.eslintrc.json` with `@typescript-eslint/recommended` base config and install the necessary devDependencies.

**Confidence:** HIGH -- verified from existing `spfx/.eslintrc.js` and `spfx/package.json`.

### Health Check Endpoint Exception
**Recommendation:** Do NOT include a health check exception. No monitoring infrastructure is in scope, and adding an anonymous endpoint creates unnecessary surface area. The `excludedPaths` property is trivial to add later if needed.

**Confidence:** MEDIUM -- reasonable for a portfolio project, but production deployments typically want health checks.

## Sources

### Primary (HIGH confidence)
- [Microsoft Learn - Azure Functions infrastructure as code](https://learn.microsoft.com/en-us/azure/azure-functions/functions-infrastructure-as-code) - Function App Bicep patterns, Consumption plan config
- [Microsoft Learn - Azure Functions Bicep quickstart](https://learn.microsoft.com/en-us/azure/azure-functions/functions-create-first-function-bicep) - Complete Bicep template for Function App
- [Microsoft Learn - authsettingsV2 Bicep reference](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/sites/config-authsettingsv2) - Full property reference for Easy Auth v2
- [Microsoft Learn - Bicep modules](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules) - Module pattern and best practices
- [Microsoft Learn - Bicep parameter files](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/parameter-files) - `.bicepparam` syntax
- [Microsoft Learn - SQL Server/Database Bicep reference](https://learn.microsoft.com/en-us/azure/templates/microsoft.sql/servers/databases) - SQL resource types
- [GitHub - actions/upload-artifact v4](https://github.com/actions/upload-artifact/tree/v4) - Artifact upload action
- Existing project files: `spfx/package.json`, `api/package.json`, `spfx/.eslintrc.js`, `api/tsconfig.json`, `spfx/tools/generate-env.js`, `api/local.settings.template.json`

### Secondary (MEDIUM confidence)
- [SPFx 1.22 CI/CD -- Upgrade pipeline to npm + Heft](https://www.petkir.at/blog/spfx-1-22-ci-cd-npm-heft) - SPFx 1.22 specific CI patterns with Heft
- [Microsoft Tech Community - Easy Auth with Bicep](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/easily-add-login-to-your-azure-app-with-bicep/4386493) - authsettingsV2 practical example
- [Azure quickstart-templates SQL database](https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.sql/sql-database/main.bicep) - Official SQL Bicep starter
- [Bicep Discussion #8569 - $5/mo SQL](https://github.com/Azure/bicep/discussions/8569) - Basic tier SKU values

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are official Microsoft/GitHub products with current documentation
- Architecture: HIGH - Patterns verified against Microsoft Learn and official quickstart templates
- Pitfalls: HIGH - Key pitfall (prebuild script) verified by reading actual project source code; auth patterns verified against official docs

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable domain -- GitHub Actions and Bicep are mature)
