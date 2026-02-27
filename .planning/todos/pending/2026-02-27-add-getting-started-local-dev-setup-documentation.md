---
created: 2026-02-27T23:53:38.548Z
title: Add Getting Started local dev setup documentation
area: docs
files:
  - README.md
  - api/local.settings.template.json
  - api/setup-db.js
  - scripts/sync-dev-config.js
  - dev.config.json
  - docs/deployment.md
---

## Problem

New developers cannot easily set up the project for local development. There is no "Getting Started" section in the README that walks through the full local dev environment setup on macOS. Currently:

- No instructions for installing prerequisites (Homebrew, Colima, Docker)
- No guidance on starting Azure SQL Edge via Docker for the local database
- No explanation of the `dev.config.json` / `../.rentavehicle/secrets.json` / `sync-dev-config.js` configuration pipeline
- The CORS origin in `local.settings.template.json` is `contoso.sharepoint.com` (a placeholder) — each dev must configure their own tenant's SharePoint domain, but this isn't documented
- No clear separation between dev and prod environments — prod currently points to local database, which will change when Azure infrastructure is provisioned
- The `setup-db.js` script was missing columns (`cancelReason`, `checkedOutAt`, `checkedInAt`, notification columns) — now fixed but the gap highlights the need for clear DB setup docs

## Solution

Add a comprehensive "Getting Started (macOS)" section to the README covering:

1. **Prerequisites**: Install Homebrew (`/bin/bash -c "$(curl -fsSL ...)"`)
2. **Install Colima & Docker**: `brew install colima docker`
3. **Start Colima**: `colima start`
4. **Start Azure SQL Edge**: `docker run` command with the dev SA password from template
5. **Seed the database**: `cd api && npm install && node setup-db.js`
6. **Configure dev identity**: Edit `dev.config.json` with role/name/email/officeLocation
7. **Configure tenant secrets**: Create `../.rentavehicle/secrets.json` with `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and tenant SharePoint domain for CORS. Explain that `sync-dev-config.js` merges template + dev.config + secrets into `local.settings.json` on every `npm start`
8. **Start the API**: `cd api && npm start`
9. **Start the SPFx workbench**: `cd spfx && npm install && npm run start`
10. **Open workbench**: Navigate to `https://{tenant}.sharepoint.com/_layouts/workbench.aspx` with debug manifest URL

Important constraints:
- `local.settings.template.json` MUST keep `contoso.sharepoint.com` as the CORS placeholder in commits
- Each developer sets their real tenant via the secrets/config mechanism
- Document that `local.settings.json` is gitignored and auto-generated
- Note that prod environment configuration (Azure SQL, Azure Functions) is covered in `docs/deployment.md` and will be updated when infrastructure is provisioned
