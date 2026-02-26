---
phase: 09-live-tenant-verification
plan: 04
status: complete
completed: 2026-02-26
commits: [c2eef8d, 4f54394]
---

# Plan 09-04 Summary: Teams App Manifest & Deployment

## What Was Done

### Task 1: Teams app manifest with activityTypes (c2eef8d)
- Created `spfx/teams/manifest.json` with all 5 original activityTypes matching `notificationService.ts`
- `webApplicationInfo.id` set to Entra app `<your-client-id>`
- Activity types: bookingConfirmed, managerBookingAlert, pickupReminder, returnReminder, bookingOverdue

### Task 2: Deploy SPFx package to Teams (manual + 4f54394)
- Multiple deployment approaches attempted; resolved through deep research into SPFx "Sync to Teams" behavior
- Root cause: SPFx "Sync to Teams" auto-generates manifest, ignoring custom `teams/manifest.json`
- Solution: `TeamsSPFxApp.zip` override mechanism — ZIP placed in `teams/` folder gets bundled into `.sppkg` and used by sync instead of auto-generated manifest
- Added `authorization` section with RSC `TeamsActivity.Send.User` permission
- Added `bookingCancelled` activity type (6th type, for admin cancel flow)
- Version bumped to 1.2.0 (Teams manifest) / 1.2.0.0 (SPFx package) for proper update detection
- App deployed, unblocked in Teams Admin Center, installed for test user

### Task 3: Re-verify Teams activity notifications (4f54394)
- Fixed `templateParameters` — all call sites now pass `vehicleName` for `{vehicle}` template
- Employee bookingConfirmed notification: PASS
- Manager managerBookingAlert notification: PASS
- No more 403 errors

## Additional Work Beyond Original Plan
- Fixed `adminBookings.ts` cancel notification: joined Vehicles table, passes vehicleName
- Implemented Teams deep link navigation: notification click opens "My Bookings" tab
- Externalized `TEAMS_APP_ID` to env var via `secrets.json` (no hardcoded IDs)
- Added `initialNav` prop to AppShell for Teams subEntityId deep linking
- SPFx webpart reads Teams context `subPageId` on init

## Decisions
- `webApplicationInfo.id` must match the backend Entra app (not SharePoint Client Extensibility Principal) because Azure Functions calls Graph with app-only tokens
- RSC `authorization` section needed despite having `TeamsActivity.Send` on the Entra app registration
- Version increment required for both SPFx and Teams manifest to force update detection
- Teams Admin Center propagation: 15-30 min after delete; app status "Gesperrt" is default for custom apps (toggle to "Zugelassen")

## Files Changed
- `spfx/teams/manifest.json` — 6 activityTypes, webApplicationInfo, authorization, v1.2.0
- `spfx/teams/TeamsSPFxApp.zip` — rebuilt with updated manifest
- `spfx/config/package-solution.json` — v1.2.0.0
- `api/src/services/notificationService.ts` — templateParameters, deep links, TEAMS_APP_ID
- `api/src/functions/adminBookings.ts` — bookingCancelled with vehicleName
- `api/local.settings.template.json` — added TEAMS_APP_ID placeholder
- `spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts` — reads Teams subEntityId
- `spfx/src/webparts/rentaVehicle/components/AppShell/AppShell.tsx` — initialNav prop
- `spfx/src/webparts/rentaVehicle/components/AppShell/IAppShellProps.ts` — initialNav prop
