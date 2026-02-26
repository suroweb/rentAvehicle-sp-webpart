# Phase 9: Session Notes — Teams Notification Debugging (2026-02-26)

## What Was Attempted

### Plan 09-04: Teams App Manifest & Deployment

**Task 1 (DONE — committed c2eef8d):**
- Created `spfx/teams/manifest.json` with all 5 activityTypes matching `notificationService.ts`
- `webApplicationInfo.id` set to Entra app `<your-client-id>`
- Activity types: bookingConfirmed, managerBookingAlert, pickupReminder, returnReminder, bookingOverdue

**Task 2 (IN PROGRESS — blocked on Teams app deployment):**
Multiple deployment approaches were tried, all resulting in the same 403 error:

1. **SPFx Sync to Teams** — App Catalog → "Sync to Teams"
   - Result: App synced but auto-generated manifest does NOT include `webApplicationInfo` or `activities` sections
   - Graph API error: "Application with AAD App Id '98f692e7-...' is not authorized to generate custom text notifications"

2. **TeamsSPFxApp.zip in SPFx project** — Created ZIP with custom manifest, rebuilt .sppkg
   - Research confirmed: SPFx "Sync to Teams" auto-generates its own manifest, ignoring custom `teams/manifest.json`
   - Placing `TeamsSPFxApp.zip` in `teams/` folder should make sync use the custom package
   - Result: App synced without error, but 403 persisted after uninstall + reinstall

3. **Added RSC permissions** — Added `authorization.permissions.resourceSpecific` with `TeamsActivity.Send.User`
   - Result: Teams sync rejected the manifest entirely ("App konnte nicht zu Teams hinzugefügt werden")
   - Reverted this change

4. **Direct upload to Teams Admin Center** — Tried uploading TeamsSPFxApp.zip as custom app
   - Result: "App with same App-ID already exists" — conflicted with SPFx-synced app
   - Deleted both apps (SPFx-synced "SPFx + Teams Dev" and custom "RentAVehicle")
   - After deletion: cache issues in Teams client, and re-upload still blocked by same ID conflict

### Plan 09-05: Deep Links & Security Verification

**Task 1 (DONE — committed e2a9959):**
- Git history verified clean — no real secrets ever committed
- All historical versions of `local.settings.json` had empty credential placeholders
- Finding documented in verification checklist Section 8

**Task 2 (PENDING):**
- APP_BASE_URL still empty in `../.rentavehicle/secrets.json`
- User needs to set the SharePoint site URL
- Blocked until Teams notification issue is resolved

### Additional Work Done (not in original plans)

**SPFx build configuration — env.generated.ts system:**
- Created `spfx/tools/generate-env.js` — reads from `../.rentavehicle/secrets.json`, generates `spfx/src/config/env.generated.ts`
- Updated `spfx/package.json` — added `prebuild` and `prestart` hooks to auto-generate
- Updated `spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts` — uses `ENV.AZURE_CLIENT_ID` instead of hardcoded placeholder
- `ApiService.ts` — kept hardcoded API URLs (not secrets)
- `.gitignore` — added `spfx/src/config/env.generated.ts`
- Follows same pattern as existing `scripts/sync-dev-config.js`

**Entra ID app registration changes:**
- Renamed from "RentAVehivle" to "RentAVehicle-API" (to match `package-solution.json` resource name)
- Added `user_impersonation` scope under "Expose an API" (required by SPFx `AadHttpClient`)
- SharePoint API access: approved `user_impersonation` permission for `RentAVehicle-API`

## Root Cause Analysis

The 403 error on `sendActivityNotification` is a **Teams app manifest issue**, not a code defect:

1. SPFx "Sync to Teams" auto-generates a manifest that omits `webApplicationInfo` and `activities`
2. Without `webApplicationInfo.id` matching the calling Entra app, Graph cannot authorize the notification
3. The `TeamsSPFxApp.zip` approach should work in theory but Teams app conflicts prevent clean deployment
4. Teams Admin Center caching/propagation delays compound the issue

## Recommended Next Steps

### Option A: Clean Teams App Deployment (retry)
1. Wait for Teams Admin Center cache to clear (may take hours)
2. Remove `.sppkg` from App Catalog to prevent auto-sync
3. Upload `TeamsSPFxApp.zip` directly in Teams Admin Center
4. Install for test user, test notification

### Option B: Use `systemDefault` Activity Type (simpler)
- Since May 2024, Graph supports `systemDefault` activity type for free-form text notifications
- Does NOT require `activities` section in manifest
- Still requires the Teams app installed with `webApplicationInfo.id` matching the calling app
- Code change in `notificationService.ts`: replace custom activityType with `systemDefault`

### Option C: Accept Partial Pass
- Teams notification code is verified correct
- The 403 is an infrastructure/deployment prerequisite, not a code bug
- Mark VRFY-04/VRFY-05 as "code verified, deployment pending"
- Move on to Phase 10

## Files Changed (uncommitted)

- `spfx/teams/manifest.json` — has activityTypes + webApplicationInfo (committed c2eef8d, unchanged since)
- `spfx/teams/TeamsSPFxApp.zip` — ZIP package for direct Teams upload
- `spfx/tools/generate-env.js` — NEW: pre-build env generator
- `spfx/src/config/env.generated.ts` — NEW: generated (gitignored)
- `spfx/package.json` — added prebuild/prestart hooks
- `spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts` — uses ENV.AZURE_CLIENT_ID
- `spfx/config/package-solution.json` — unchanged (resource: "RentAVehicle-API" matches Entra app name)
- `.gitignore` — added env.generated.ts
- `api/check-teams-app.js` — temp diagnostic script (can delete)
