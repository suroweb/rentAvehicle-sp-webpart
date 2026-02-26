---
phase: 09-live-tenant-verification
plan: 05
status: complete
completed: 2026-02-26
commits: [e2a9959, 4f54394]
---

# Plan 09-05 Summary: Deep Links & Security Verification

## What Was Done

### Task 1: Verify git history contains no real secrets (e2a9959)
- All historical versions of `api/local.settings.json` confirmed to have empty credential placeholders
- No secret rotation needed
- Finding documented in verification checklist Section 8

### Task 2: Deep links for notifications (4f54394)
- Original plan called for setting `APP_BASE_URL` to a SharePoint site URL
- Instead, implemented Teams-native deep links using `subEntityId`
- Notification click-through opens the RentAVehicle personal tab directly in Teams at "My Bookings"
- `TEAMS_APP_ID` externalized to `secrets.json` / env var (no hardcoded IDs)
- `APP_BASE_URL` still used for email and calendar event links (remains configurable)

## Deviation from Plan
- Plan originally required `APP_BASE_URL` for all deep links (email, calendar, Teams)
- Teams notification deep links were decoupled from `APP_BASE_URL` — now use Teams-native `/l/entity/` format
- This is an improvement: Teams notifications open directly in Teams app, not via SharePoint redirect
- Email and calendar links still use `APP_BASE_URL` (unchanged, configurable per deployment)

## Files Changed
- `api/src/services/notificationService.ts` — Teams deep link via TEAMS_APP_ID + subEntityId
- `api/local.settings.template.json` — TEAMS_APP_ID placeholder added
- `.planning/phases/09-live-tenant-verification/09-VERIFICATION-CHECKLIST.md` — security finding documented
