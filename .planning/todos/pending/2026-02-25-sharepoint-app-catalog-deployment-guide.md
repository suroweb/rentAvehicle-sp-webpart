---
created: 2026-02-25T20:30:00.000Z
title: SharePoint App Catalog deployment guide
area: docs
files:
  - spfx/config/package-solution.json
  - spfx/sharepoint/solution/
---

## Problem

No documentation for deploying the SPFx webpart to a SharePoint tenant. The .sppkg packaging, App Catalog upload, API permission approval, and page setup steps are undocumented.

## Solution

Step-by-step guide covering:
- Build the SPFx solution: `npm run build && npx gulp bundle --ship && npx gulp package-solution --ship`
- Create App Catalog site collection (if not exists)
- Upload .sppkg to App Catalog
- "Trust" the solution (deploy globally or site-scoped)
- Approve API permission requests in SharePoint Admin Center
- Add the webpart to a SharePoint page
- Configure webpart properties (support contact)
- Optional: deploy as Teams app via Teams Admin Center
