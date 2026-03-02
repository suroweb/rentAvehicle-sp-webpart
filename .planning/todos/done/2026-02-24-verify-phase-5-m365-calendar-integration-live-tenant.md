---
created: 2026-02-24T23:46:14.484Z
title: Verify Phase 5 M365 calendar integration live tenant
area: api
files:
  - .planning/phases/05-m365-calendar-integration/05-VERIFICATION.md
  - api/src/services/calendarService.ts
  - api/src/functions/calendarAdmin.ts
  - scripts/provision-vehicle-mailbox.ps1
---

## Problem

Phase 5 (M365 Calendar Integration) passed all automated code-level verification (15/15 must-haves), but 7 items require live M365 tenant testing. The user does not currently have the SPFx solution deployed to SharePoint or the app registration configured, so this verification must be deferred.

Prerequisites before testing:
1. App registration in Entra ID with `Calendars.ReadWrite` application permission (admin consent granted)
2. SPFx solution deployed to a SharePoint tenant
3. `APP_BASE_URL` environment variable set in `api/local.settings.json`
4. At least one vehicle with an Exchange equipment mailbox provisioned via `scripts/provision-vehicle-mailbox.ps1`
5. Mailbox linked to vehicle via `PATCH /api/backoffice/vehicles/{id}/mailbox`

## Solution

Run through all 7 verification items from `05-VERIFICATION.md`:

1. Create a booking → verify vehicle resource calendar event appears in Outlook (showAs=Busy)
2. Create a booking → verify employee personal calendar event appears (showAs=Free, 30-min reminder)
3. Cancel a booking → verify both events show `[CANCELLED]` prefix
4. Check out a vehicle → verify both events show `[IN USE]` prefix
5. Return a vehicle → verify both events show `[RETURNED]` prefix
6. `GET /api/backoffice/calendar/status` → verify provisioning dashboard returns correctly
7. `POST /api/backoffice/calendar/backfill` → verify missing calendar events get created

After verification passes, mark phase 5 as complete: `/gsd:execute-phase 5` (will resume from verification step).
