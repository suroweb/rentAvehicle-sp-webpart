---
created: 2026-02-25T20:30:00.000Z
title: App registration and Graph API setup guide
area: docs
files:
  - api/src/middleware/auth.ts
  - api/src/services/graphService.ts
  - api/src/services/calendarService.ts
  - api/src/services/notificationService.ts
  - spfx/config/package-solution.json
---

## Problem

No documentation for setting up the Entra ID app registration, app roles, Graph API permissions, or admin consent. A new developer or tenant admin can't configure the auth layer without reading the source code.

## Solution

Step-by-step guide covering:
- Create app registration (RentAVehicle-API) with Application ID URI
- Expose API scope: `user_impersonation`
- Define app roles in manifest: Employee, Manager, Admin, SuperAdmin
- Create Entra ID groups and assign to app roles
- Configure Graph API permissions: User.Read.All, Mail.Send, Calendars.ReadWrite, TeamsActivity.Send.User
- Grant admin consent
- Configure Easy Auth on Azure Functions App
- Configure SPFx `webApiPermissionRequests` in package-solution.json
- SPFx API permission approval in SharePoint Admin Center
