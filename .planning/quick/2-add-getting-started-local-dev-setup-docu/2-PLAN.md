---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/sync-dev-config.js
  - README.md
autonomous: true
requirements: [DOCS-GETTING-STARTED]

must_haves:
  truths:
    - "A new developer on macOS can go from git clone to running API + SPFx workbench by following the README"
    - "The CORS origin is automatically set to the developer's real tenant domain via the secrets/sync pipeline"
    - "The contoso.sharepoint.com placeholder remains in local.settings.template.json in git"
    - "local.settings.json is auto-generated on every npm start and never committed"
    - "Developer understands the three-source config pipeline: template + dev.config + secrets"
  artifacts:
    - path: "README.md"
      provides: "Getting Started (macOS) section with 10-step walkthrough"
      contains: "Getting Started (macOS)"
    - path: "scripts/sync-dev-config.js"
      provides: "CORS domain replacement from secrets SHAREPOINT_DOMAIN key"
      contains: "SHAREPOINT_DOMAIN"
  key_links:
    - from: "secrets.json SHAREPOINT_DOMAIN"
      to: "Host.CORS in generated local.settings.json"
      via: "sync-dev-config.js Step 4"
      pattern: "SHAREPOINT_DOMAIN"
---

<objective>
Add a comprehensive "Getting Started (macOS)" section to the README and fix the CORS sync gap in sync-dev-config.js.

Purpose: New developers currently cannot set up local development without tribal knowledge. The README has a generic "Getting Started" that skips Docker/Colima setup, database seeding, the three-source config pipeline, and CORS tenant configuration. Additionally, sync-dev-config.js only merges secrets into `Values` but does not replace the `contoso.sharepoint.com` CORS placeholder in `Host.CORS`, meaning auto-generated local.settings.json always has the wrong CORS origin.

Output: Enhanced README with step-by-step macOS setup guide, and sync-dev-config.js that handles CORS domain replacement.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

Source files that define the config pipeline:
@scripts/sync-dev-config.js
@api/local.settings.template.json
@dev.config.json
@api/setup-db.js
@api/package.json (scripts.prestart runs sync-dev-config.js)
@README.md

<interfaces>
From scripts/sync-dev-config.js:
- Reads: api/local.settings.template.json (base), dev.config.json (role/name/email/officeLocation), ../.rentavehicle/secrets.json (tenant secrets)
- Writes: api/local.settings.json (gitignored, auto-generated)
- DEV_CONFIG_MAP: { role: LOCAL_DEV_ROLE, name: LOCAL_DEV_NAME, email: LOCAL_DEV_EMAIL, officeLocation: LOCAL_DEV_OFFICE_LOCATION }
- VALID_ROLES: ['SuperAdmin', 'Admin', 'Manager', 'Employee']
- Secrets are merged into settings.Values only -- Host.CORS is NOT currently handled

From api/local.settings.template.json:
- Host.CORS: "https://localhost:4321,http://localhost:4321,https://contoso.sharepoint.com"
- Values.AZURE_SQL_PASSWORD: "YourStrong!Pass123" (dev SA password for Azure SQL Edge)
- Values.AZURE_SQL_SERVER: "localhost", AZURE_SQL_DATABASE: "RentAVehicle"

From api/package.json:
- scripts.prestart: "node ../scripts/sync-dev-config.js && npm run build"
- This means sync runs automatically on every `npm start`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CORS domain replacement to sync-dev-config.js</name>
  <files>scripts/sync-dev-config.js</files>
  <action>
Add a Step 4 to sync-dev-config.js AFTER secrets are applied (after the current Step 3 block, before the write). This step replaces the CORS placeholder:

1. Check if `secrets.SHAREPOINT_DOMAIN` exists (e.g., "yourtenant.sharepoint.com")
2. If present, replace `contoso.sharepoint.com` in `settings.Host.CORS` with the value of `secrets.SHAREPOINT_DOMAIN`
3. Log: `  Applied CORS domain: {domain}`
4. If not present, log: `  CORS domain not set (add SHAREPOINT_DOMAIN to secrets.json for hosted workbench)`

Also update the "no secrets file found" help text (lines 99-107) to include `SHAREPOINT_DOMAIN` in the example:
```
  "SHAREPOINT_DOMAIN": "yourtenant.sharepoint.com",
```

The CORS string format is: `"https://localhost:4321,http://localhost:4321,https://{SHAREPOINT_DOMAIN}"` -- use simple string replace of `contoso.sharepoint.com` with the secrets value.

IMPORTANT: Do NOT modify local.settings.template.json. The placeholder `contoso.sharepoint.com` MUST remain in the template file in git.
  </action>
  <verify>
    Run: `node scripts/sync-dev-config.js --clean` (should succeed)
    Then verify the script parses without syntax errors: `node -c scripts/sync-dev-config.js` (should print nothing / exit 0)
  </verify>
  <done>sync-dev-config.js has a Step 4 that replaces contoso.sharepoint.com in Host.CORS with SHAREPOINT_DOMAIN from secrets.json. Template file unchanged. Script parses without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Replace Getting Started section in README with comprehensive macOS setup guide</name>
  <files>README.md</files>
  <action>
Replace the existing "Getting Started" section (lines 116-176, from `## Getting Started` through the TIP blockquote) with a comprehensive "Getting Started (macOS)" section. Keep everything before and after that section intact.

The new section must follow this exact structure and contain accurate values extracted from the actual source files:

## Getting Started (macOS)

Brief intro: This guide walks through local development setup on macOS. For production deployment, see docs/deployment.md.

### Prerequisites

- Node.js 22 (LTS) and npm
- Azure Functions Core Tools v4 (`npm install -g azure-functions-core-tools@4 --unsafe-perm true`)
- Microsoft 365 developer tenant with SharePoint admin access
- Entra ID app registration (follow docs/app-registration.md first)

### 1. Install Docker (via Colima)

```bash
brew install colima docker
colima start
```

Explain: Colima is a lightweight Docker runtime for macOS. No Docker Desktop license required.

### 2. Start the local database

```bash
docker run -d --name rentavehicle-db \
  -e "ACCEPT_EULA=1" \
  -e "MSSQL_SA_PASSWORD=YourStrong!Pass123" \
  -p 1433:1433 \
  mcr.microsoft.com/azure-sql-edge
```

Explain: Azure SQL Edge runs the same SQL engine as Azure SQL but on ARM64/x64 Docker. The SA password matches `local.settings.template.json`.

### 3. Seed the database

```bash
cd api
npm install
node setup-db.js
```

Explain: Creates the `RentAVehicle` database, all tables (Locations, Categories, Vehicles, Bookings), and seeds test data (Bucharest + Cluj locations, Sedan + SUV categories, 3 test vehicles).

### 4. Configure your dev identity

Edit `dev.config.json` in the project root:

```json
{
  "role": "Admin",
  "name": "Your Name",
  "email": "you@yourtenant.onmicrosoft.com",
  "officeLocation": "Bucharest"
}
```

Explain: This sets your LOCAL_DEV_* values. The API uses these to simulate your identity during local development. Valid roles: SuperAdmin, Admin, Manager, Employee. The `officeLocation` must match a seeded location name.

### 5. Configure tenant secrets

Create `../.rentavehicle/secrets.json` (one directory above the project root -- keeps secrets outside the repo):

```json
{
  "AZURE_TENANT_ID": "your-tenant-id",
  "AZURE_CLIENT_ID": "your-client-id",
  "AZURE_CLIENT_SECRET": "your-client-secret",
  "NOTIFICATION_SENDER_EMAIL": "noreply@yourtenant.onmicrosoft.com",
  "APP_BASE_URL": "https://yourtenant.sharepoint.com/sites/rentavehicle",
  "TEAMS_APP_ID": "your-teams-app-id",
  "SHAREPOINT_DOMAIN": "yourtenant.sharepoint.com"
}
```

Explain how the config pipeline works:

> **How configuration syncs:** On every `npm start`, the `prestart` script runs `scripts/sync-dev-config.js` which merges three sources into `api/local.settings.json`:
>
> 1. `api/local.settings.template.json` -- committed base with safe defaults
> 2. `dev.config.json` -- your role, name, email, officeLocation
> 3. `../.rentavehicle/secrets.json` -- tenant secrets (IDs, keys, domain)
>
> The generated `local.settings.json` is gitignored and never committed. The `SHAREPOINT_DOMAIN` value also replaces the CORS placeholder so the hosted workbench can call the local API.

### 6. Start the API

```bash
cd api
npm start
```

Explain: Runs sync-dev-config.js (generates local.settings.json), builds TypeScript, then starts Azure Functions on http://localhost:7071.

### 7. Start the SPFx workbench

In a separate terminal:

```bash
cd spfx
npm install
npm run start
```

### 8. Open the workbench

Two options:
- **Local workbench**: https://localhost:4321/temp/workbench.html (limited -- no real M365 context)
- **Hosted workbench** (recommended): `https://yourtenant.sharepoint.com/_layouts/workbench.aspx` -- append `?debug=true&noredir=true&debugManifestsFile=https://localhost:4321/temp/manifests.js`

Add a NOTE callout: The hosted workbench requires the SPFx dev certificate to be trusted. Run `npx gulp trust-dev-cert` in the spfx directory if you see certificate errors.

### Environment notes

Add a brief section clarifying:
- **Local dev** uses Azure SQL Edge on Docker (localhost:1433) with the `sa` account
- **Production** uses Azure SQL and Azure Functions -- see docs/deployment.md
- The `contoso.sharepoint.com` in the template is a placeholder -- your real domain is injected via secrets
- To switch roles quickly: `node scripts/sync-dev-config.js --role Admin` (also accepts Manager, Employee, SuperAdmin)
  </action>
  <verify>
    Verify the README contains the new section: `grep -c "Getting Started (macOS)" README.md` should return 1.
    Verify the 8 numbered steps exist: `grep -c "^### [1-8]\." README.md` should return 8.
    Verify contoso.sharepoint.com is NOT mentioned as something to edit (only as the placeholder that gets auto-replaced).
  </verify>
  <done>
    README.md contains a "Getting Started (macOS)" section with 8 numbered steps covering: Colima/Docker install, Azure SQL Edge, database seeding, dev.config.json, secrets.json with SHAREPOINT_DOMAIN, API start, SPFx start, and workbench URLs. The config pipeline (template + dev.config + secrets -> local.settings.json) is clearly explained. Template placeholder contoso.sharepoint.com is documented as auto-replaced, not manually edited.
  </done>
</task>

</tasks>

<verification>
1. `node -c scripts/sync-dev-config.js` exits 0 (no syntax errors)
2. `grep "SHAREPOINT_DOMAIN" scripts/sync-dev-config.js` shows the new CORS replacement logic
3. `grep "Getting Started (macOS)" README.md` finds the new section
4. `grep "contoso.sharepoint.com" api/local.settings.template.json` still shows the placeholder (template unchanged)
5. `grep -c "^### [1-8]\." README.md` returns 8 (all steps present)
</verification>

<success_criteria>
- A developer following the README steps 1-8 can go from zero to running API + SPFx workbench
- The sync-dev-config.js handles CORS domain replacement so local.settings.json has the correct tenant CORS origin
- local.settings.template.json retains the contoso.sharepoint.com placeholder in git
- The three-source config pipeline is clearly documented
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-getting-started-local-dev-setup-docu/2-SUMMARY.md`
</output>
