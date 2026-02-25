---
created: 2026-02-25T20:30:00.000Z
title: CI CD pipeline GitHub Actions
area: tooling
files:
  - spfx/package.json
  - api/package.json
---

## Problem

No automated build or deployment pipeline. Frontend (SPFx) and backend (Azure Functions) are built and deployed manually. No automated tests run on push. No staging environment.

## Solution

Create `.github/workflows/` with:
- **build.yml**: On PR — lint, type-check, build both spfx/ and api/
- **deploy-api.yml**: On merge to main — build api/, deploy to Azure Functions
- **deploy-spfx.yml**: On merge to main — build spfx/, package .sppkg, upload to SharePoint App Catalog (or artifact for manual deploy)
- Environment secrets configuration guide (AZURE_CREDENTIALS, SQL connection, etc.)
