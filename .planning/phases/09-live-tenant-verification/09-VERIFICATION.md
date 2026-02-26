---
phase: 09-live-tenant-verification
verified: 2026-02-26T12:00:00Z
status: gaps_found
score: 4/5 success criteria verified (VRFY-04 and VRFY-05 partial)
gaps:
  - truth: "Teams activity feed notification appears for the booking employee and for the manager"
    status: partial
    reason: "Teams activity notifications return 403 Forbidden because the app is not installed in Teams for the target user. The Graph API call is correctly structured and TeamsActivity.Send permission is granted, but delivery requires the SPFx webpart to be deployed as a Teams app with activity types declared in the app manifest. This cannot be confirmed on a live tenant without that deployment."
    artifacts:
      - path: "api/src/services/notificationService.ts"
        issue: "sendTeamsActivityNotification correctly calls /users/{userId}/teamwork/sendActivityNotification but gets 403 in practice due to missing Teams app installation, not a code defect"
    missing:
      - "SPFx Teams app manifest declaring activityTypes: bookingConfirmed, managerBookingAlert, pickupReminder, returnReminder, bookingOverdue"
      - "Teams app installation for target users via tenant admin or sideloading"
      - "End-to-end delivery confirmation in Teams activity feed (not just code-level verification)"
  - truth: "APP_BASE_URL is not configured in local.settings.json"
    status: partial
    reason: "APP_BASE_URL is set to empty string in local.settings.json. This means calendar event bodies and email deep links render as bare query strings (e.g., '?bookingId=1016') rather than full URLs. The Teams webUrl falls back to a generic Teams deep link which is valid, but email and calendar body links are broken."
    artifacts:
      - path: "api/local.settings.json"
        issue: "APP_BASE_URL is empty -- email and calendar event body deep links are non-functional"
    missing:
      - "APP_BASE_URL set to the real SharePoint site URL (e.g., https://contoso.sharepoint.com/sites/rentavehicle)"
human_verification:
  - test: "Confirm email deep links are functional"
    expected: "Email body 'View Booking' and 'Cancel Booking' buttons open the correct SPFx page with bookingId parameter"
    why_human: "APP_BASE_URL is empty; cannot verify URL correctness programmatically without the real SharePoint URL"
  - test: "Deploy SPFx app as Teams app and retest VRFY-04 and VRFY-05"
    expected: "Teams activity feed shows 'bookingConfirmed' notification for employee and 'managerBookingAlert' for manager after booking creation"
    why_human: "Requires Teams app deployment with manifest declaring activityTypes; cannot replicate in local dev"
---

# Phase 9: Live Tenant Verification Report

**Phase Goal:** All M365 integrations (calendars, email, Teams notifications) are confirmed working against a real tenant
**Verified:** 2026-02-26T12:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                      | Status       | Evidence                                                                                             |
| --- | ------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Creating a booking produces a resource calendar event visible in Outlook for the vehicle's resource mailbox | VERIFIED | `createCalendarEvent` called on `resourceMailboxEmail` via `/users/{email}/events`; VRFY-01a-01d all pass in checklist; bookings 1012-1015 tested |
| 2   | Creating a booking produces a personal calendar event in the booking employee's Outlook calendar | VERIFIED | `createCalendarEvent` called on `row.userEmail` via `/users/{email}/events`; VRFY-02a-02c all pass in checklist |
| 3   | Booking confirmation email arrives in the employee's inbox with correct booking details    | VERIFIED     | `sendBookingConfirmationEmail` calls `/users/${senderEmail}/sendMail`; VRFY-03a-03c pass; Graph API returned 202 on live tenant |
| 4   | Teams activity feed notification appears for the booking employee and for the manager      | PARTIAL      | Code is correctly structured; Graph API returns 403 (app not installed in Teams) -- delivery unconfirmed on live tenant |
| 5   | Cancelling or modifying a booking updates or removes the corresponding calendar events     | VERIFIED     | `syncBookingToCalendars('cancelled')` tested on booking 1013; both resource and employee events updated with [CANCELLED] prefix |

**Score:** 4/5 success criteria verified (Truth 4 is partial)

---

### Required Artifacts

#### From 09-01-PLAN.md (Environment Setup)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `api/local.settings.json` | Live tenant credentials | VERIFIED with gap | AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, NOTIFICATION_SENDER_EMAIL all present with real values; APP_BASE_URL is empty |
| `.planning/phases/09-live-tenant-verification/09-VERIFICATION-CHECKLIST.md` | Granular checklist for all 5 criteria | VERIFIED | 9-section checklist exists with 11 checked [x] items and 4 partial [~] items; sign-off in Section 9 |

#### From 09-02-PLAN.md (Calendar Integration)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `api/src/services/calendarService.ts` | Full calendar CRUD via Graph API | VERIFIED | 547 lines; `syncBookingToCalendars` handles created/cancelled/checked_out/checked_in/time_modified; both resource and employee event paths implemented |
| `.planning/phases/09-live-tenant-verification/09-VERIFICATION-CHECKLIST.md` | Section 4 filled with pass results | VERIFIED | All VRFY-01a through VRFY-02c marked [x] with booking IDs and subject lines |

#### From 09-03-PLAN.md (Notification Verification)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `api/src/services/notificationService.ts` | Email + Teams notification orchestration | VERIFIED | 653 lines; `sendBookingNotifications` dispatches email, Teams employee, Teams manager in parallel via `Promise.allSettled` |
| `api/src/templates/emailConfirmation.ts` | HTML email template | VERIFIED | 142 lines; `buildConfirmationEmailHtml` generates full HTML with booking table, vehicle details, View/Cancel buttons |
| `api/src/templates/adaptiveCards.ts` | Teams preview text builders | VERIFIED | 89 lines; `buildBookingConfirmationPreview`, `buildManagerAlertPreview`, `buildReminderPreview`, `buildOverduePreview` all implemented |
| `.planning/phases/09-live-tenant-verification/09-VERIFICATION-CHECKLIST.md` | Sections 5-9 filled | VERIFIED | VRFY-03 is 3/3 [x]; VRFY-04 and VRFY-05 are 2/2 [~]; Section 8 documents issues; Section 9 has sign-off |

---

### Key Link Verification

#### 09-01 Links

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `api/src/services/graphService.ts` | Entra ID app registration | `new ClientSecretCredential` with AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET | WIRED | `ClientSecretCredential` imported and used when `AZURE_CLIENT_SECRET` env var is set; live credentials confirmed in local.settings.json |
| `api/src/services/notificationService.ts` | Graph sendMail API | `NOTIFICATION_SENDER_EMAIL` env var | WIRED | Line 124: `/users/${senderEmail}/sendMail`; senderEmail read from env var; env var set to `admin@contoso.onmicrosoft.com` |

#### 09-02 Links

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `api/src/services/calendarService.ts` | Graph API `/users/{id}/events` | `createCalendarEvent` and `updateCalendarEvent` | WIRED | Lines 155-157: `.api('/users/${userIdOrEmail}/events').post(...)` and line 222: `.api('/users/${userIdOrEmail}/events/${eventId}').patch(...)` |
| `api/src/functions/bookings.ts` | `api/src/services/calendarService.ts` | `syncBookingToCalendars` fire-and-forget call | WIRED | Line 38 imports `syncBookingToCalendars`; lines 238, 306, 359, 425 call it for created/cancelled/checked_out/checked_in |

#### 09-03 Links

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `api/src/services/notificationService.ts` | Graph API `/users/{email}/sendMail` | `sendBookingConfirmationEmail` | WIRED | Line 124: `client.api('/users/${senderEmail}/sendMail').post(...)` with full email message body |
| `api/src/services/notificationService.ts` | Graph API `/users/{id}/teamwork/sendActivityNotification` | `sendTeamsActivityNotification` | WIRED (code) / NOT_DELIVERED | Line 192: `.api('/users/${userId}/teamwork/sendActivityNotification').post(...)` -- call is correctly structured but returns 403 in production (Teams app not installed) |
| `api/src/services/notificationService.ts` | Graph API `/users/{id}/manager` | `getManagerInfo` | WIRED | Line 35: `.api('/users/${userId}/manager').select('id,mail,displayName').get()` -- manager lookup confirmed working on live tenant |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| VRFY-01 | 09-01-PLAN.md, 09-02-PLAN.md | M365 calendar integration creates/updates resource calendar events on live tenant | SATISFIED | calendarService.ts creates/updates via `/users/{email}/events`; checklist VRFY-01a-d all [x]; bookings 1012-1015 tested against contoso.onmicrosoft.com |
| VRFY-02 | 09-01-PLAN.md, 09-02-PLAN.md | Employee personal calendar events are created on booking via Graph API on live tenant | SATISFIED | calendarService.ts creates personal events on `row.userEmail`; checklist VRFY-02a-c all [x]; booking 1012 confirmed on admin@contoso.onmicrosoft.com |
| VRFY-03 | 09-01-PLAN.md, 09-03-PLAN.md | Email notifications (booking confirmation) deliver on live tenant | SATISFIED | notificationService.ts calls `/users/${senderEmail}/sendMail`; checklist VRFY-03a-c all [x]; Graph API returned 202 on live tenant |
| VRFY-04 | 09-01-PLAN.md, 09-03-PLAN.md | Teams activity feed notifications deliver on live tenant | PARTIALLY SATISFIED | Code correctly calls `/users/{id}/teamwork/sendActivityNotification`; 403 returned because Teams app not installed; checklist marks [~] not [x] |
| VRFY-05 | 09-01-PLAN.md, 09-03-PLAN.md | Manager notification alerts deliver on live tenant | PARTIALLY SATISFIED | Manager lookup via `/users/{id}/manager` works (self-manager confirmed); Teams notification fails same as VRFY-04; checklist marks [~] |

**Orphaned requirements:** None -- all 5 VRFY-01 through VRFY-05 requirements mapped to Phase 9 plans and accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `api/local.settings.json` | 24 | `"APP_BASE_URL": ""` | Warning | Email deep links and calendar event body links render as bare query strings (e.g., `?bookingId=1016`). Email and calendar "View Booking"/"Cancel Booking" links are non-functional. Teams webUrl uses fallback generic deep link (valid). |
| `api/local.settings.json` | 17-18 | `LOCAL_DEV_EMAIL: test@contoso.com`, `LOCAL_DEV_NAME: Test User` | Info | These are fallback values -- auth middleware first tries Graph lookup using NOTIFICATION_SENDER_EMAIL. However, if Graph lookup fails, the fallback is a non-tenant user. Not blocking for current verification, but LOCAL_DEV_EMAIL should be updated to the real tenant email for consistency. |
| `api/src/services/calendarService.ts` | 495-539 | `time_modified` action is a "future-wiring hook" with no endpoint currently calling it | Info | The comment at line 498 explicitly documents this. Not a blocker -- no modify-booking endpoint exists yet (deferred to future phase). |

**No blocker anti-patterns found in service implementations.** The `return null` at calendarService.ts:185 is a legitimate error-path return from `createCalendarEvent` after logging the exception, not a stub.

---

### Human Verification Required

#### 1. Email Deep Link Functionality

**Test:** Set APP_BASE_URL to the real SharePoint URL and create a booking. Open the confirmation email and click "View Booking".
**Expected:** Browser opens the SPFx webpart page with the booking highlighted.
**Why human:** APP_BASE_URL is currently empty -- cannot verify URL correctness programmatically without the real SharePoint deployment URL.

#### 2. Teams Activity Feed Delivery (VRFY-04 + VRFY-05)

**Test:** Deploy the SPFx webpart as a Teams app (with `activities` section in manifest.json declaring `bookingConfirmed`, `managerBookingAlert` activityTypes) and install it for the test user. Create a booking. Check Teams activity feed.
**Expected:** "RentAVehicle" notification appears in Teams activity bell with vehicle name and booking time in preview text. A second notification appears for the manager (self-manager) with employee name and vehicle.
**Why human:** This requires Teams app deployment and cannot be tested in local dev. The code is correctly structured but actual delivery cannot be confirmed without the Teams deployment.

---

### Gaps Summary

**Two gaps prevent full goal achievement:**

**Gap 1 (VRFY-04 + VRFY-05 -- Teams activity delivery):** This is the only gap that directly affects the phase goal. Teams activity feed notifications are structurally correct -- the Graph API call is well-formed, the `TeamsActivity.Send` permission is granted, the webUrl fallback was fixed (commit b0bbfb2), and the manager lookup works. The 403 error is an infrastructure prerequisite: the Graph API requires the calling app to be installed in Teams for the target user with activity types declared in the manifest. This is not a code defect; it is a deployment requirement. VRFY-04 and VRFY-05 are partial passes -- code is verified, delivery is not.

**Gap 2 (APP_BASE_URL empty):** APP_BASE_URL is set to empty string. This means every email sent and every calendar event created during Phase 9 testing contained broken deep links in the body. VRFY-03c ("email body includes deep link") was verified by code inspection only, not by clicking a functional link. This is a warning-level gap -- the email delivery mechanism works, but link usability is unverified.

Both gaps are infrastructure/configuration items, not code defects. The core integrations (calendar CRUD, Graph sendMail, manager lookup) are all substantively implemented and wired, confirmed against the live contoso.onmicrosoft.com tenant.

---

### Additional Findings

**Secrets in local.settings.json:** The file contains real AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_CLIENT_ID, and NOTIFICATION_SENDER_EMAIL values and is committed to git history (the secure secrets workflow created in this phase was intended to prevent this, but the actual local.settings.json file with real secrets appears to be committed). The `.gitignore-secrets` artifact referenced in the SUMMARY is missing from the repo (`scripts/secrets-template.js` and `api/.local.settings.template.json` also not found). This is a security concern that should be verified -- if these secrets are in git history, the client secret should be rotated.

---

## Summary Table

| Criterion | Status |
| --------- | ------ |
| VRFY-01: Resource calendar events create/update on live tenant | PASS |
| VRFY-02: Employee personal calendar events create on live tenant | PASS |
| VRFY-03: Email notifications deliver on live tenant | PASS |
| VRFY-04: Teams activity feed delivers to employee | PARTIAL (code verified, delivery requires Teams app deployment) |
| VRFY-05: Manager notification alert delivers | PARTIAL (manager lookup works, delivery requires Teams app deployment) |
| API TypeScript build | PASS (zero errors) |
| All services wired to booking endpoints | PASS |
| Key links to Graph API verified | PASS (calendar, email, manager lookup); PARTIAL (Teams activity) |

---

_Verified: 2026-02-26T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
