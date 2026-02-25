---
phase: 05-m365-calendar-integration
verified: 2026-02-25T12:00:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Create a booking for a vehicle that has resourceMailboxEmail set, then open Outlook"
    expected: "Vehicle resource calendar shows event with subject '{EmployeeName} - {Make} {Model} ({Plate})' marked as Busy. Employee personal calendar shows 'Vehicle Rental: {Make} {Model} ({Plate})' marked as Free with 30-minute reminder."
    why_human: "Requires live M365 tenant with Calendars.ReadWrite application permission granted, Exchange equipment mailbox provisioned, and actual Graph API call execution. Cannot be verified by code inspection alone."
  - test: "Cancel the booking created above, then check both Outlook calendars"
    expected: "Both events now have subject prefixed with '[CANCELLED]' and body contains cancellation banner. Events are not deleted."
    why_human: "Requires live M365 tenant and real Graph API PATCH call execution."
  - test: "Check out a booking, then check both Outlook calendars"
    expected: "Both events now have subject prefixed with '[IN USE]' and body contains check-out status banner."
    why_human: "Requires live M365 tenant and real Graph API PATCH call execution."
  - test: "Return (check in) a booking, then check both Outlook calendars"
    expected: "Both events now have subject prefixed with '[RETURNED]' and body contains return status banner."
    why_human: "Requires live M365 tenant and real Graph API PATCH call execution."
  - test: "Create a booking for a vehicle WITHOUT a resourceMailboxEmail, then check Outlook"
    expected: "Booking succeeds. Only the employee personal calendar event is created (vehicle event skipped). No errors returned from booking endpoint."
    why_human: "Requires live Graph API call to confirm graceful skip logic functions as coded."
  - test: "Call GET /api/backoffice/calendar/status as an Admin user"
    expected: "Returns JSON with total/provisioned/unprovisioned counts and vehicle list showing which have resourceMailboxEmail set."
    why_human: "Requires running API with connected database."
  - test: "Run POST /api/backoffice/calendar/backfill as a SuperAdmin user with pre-existing bookings missing calendar event IDs"
    expected: "Returns summary {total, synced, failed}. Bookings that had null vehicleCalendarEventId now have events created in Outlook."
    why_human: "Requires live M365 tenant, running API, and database with existing bookings."
---

# Phase 5: M365 Calendar Integration Verification Report

**Phase Goal:** Vehicle bookings are natively visible in Outlook -- each vehicle has a resource calendar showing its schedule, and employees see their rentals on their personal Outlook calendar
**Verified:** 2026-02-25T12:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When an employee books a vehicle, a calendar event is created on the vehicle's resource calendar | WIRED | `syncBookingToCalendars(result.id, 'created')` called in `createBookingEndpoint` (bookings.ts:236). calendarService.ts creates POST to `/users/{resourceMailboxEmail}/events` with showAs='busy' (line 309-319). |
| 2 | When an employee books a vehicle, a calendar event is created on the employee's personal Outlook calendar | WIRED | Same 'created' action creates POST to `/users/{userEmail}/events` with showAs='free', isReminderOn=true, reminderMinutesBeforeStart=30 (calendarService.ts:323-333). |
| 3 | When a booking is cancelled, both calendar events are updated to show CANCELLED status (not deleted) | WIRED | `syncBookingToCalendars(id, 'cancelled')` in cancelBookingEndpoint (bookings.ts:299) and adminCancelBookingEndpoint (adminBookings.ts:145). calendarService.ts PATCHes subject with '[CANCELLED]' prefix and status banner body. Events are never deleted. |
| 4 | When a vehicle is checked out, both calendar events are updated to reflect IN USE status | WIRED | `syncBookingToCalendars(id, 'checked_out')` in checkOutBookingEndpoint (bookings.ts:352). calendarService.ts PATCHes subject with '[IN USE]' prefix and status banner. |
| 5 | When a vehicle is returned, both calendar events are updated to reflect RETURNED status | WIRED | `syncBookingToCalendars(id, 'checked_in')` in checkInBookingEndpoint (bookings.ts:418). calendarService.ts PATCHes subject with '[RETURNED]' prefix and status banner. |
| 6 | When a booking's time is modified, both calendar events are updated with new start/end times (hook implemented, pending future endpoint) | VERIFIED | 'time_modified' action implemented in calendarService.ts (lines 495-538) with PATCHing of start/end and regenerated body. Code comment explicitly documents it as a future-wiring hook. No existing endpoint calls it -- as designed. |
| 7 | Calendar sync failures do not block or roll back booking operations | VERIFIED | All 5 sync calls use `.catch()` pattern: `syncBookingToCalendars(...).catch((error) => { context.error(...) })`. HTTP response is returned before/independently of sync. syncBookingToCalendars has outer try/catch that never throws (calendarService.ts:540-545). |
| 8 | Employee calendar events show as Free (do not block Teams presence) | VERIFIED | calendarService.ts line 330: `showAs: 'free'` for employee events. Vehicle resource events use `showAs: 'busy'` (line 317). |

**Score: 8/8 truths verified**

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A PowerShell script exists that creates an Exchange equipment mailbox for a vehicle | VERIFIED | `scripts/provision-vehicle-mailbox.ps1` exists, 219 lines, contains `New-Mailbox -Equipment` (line 101). |
| 2 | The PowerShell script configures calendar processing to auto-decline external bookings | VERIFIED | `Set-CalendarProcessing` with `-AutomateProcessing AutoAccept`, `-AllBookInPolicy $false`, `-BookInPolicy "$AppServiceAccount"`, `-AllowConflicts $false` (lines 121-125). |
| 3 | The PowerShell script grants all employees Reviewer access to the vehicle calendar | VERIFIED | `Set-MailboxFolderPermission -Identity "${alias}:\Calendar" -User Default -AccessRights Reviewer` (line 140). |
| 4 | Admin can set a vehicle's resource mailbox email after Exchange provisioning | VERIFIED | PATCH /api/backoffice/vehicles/{id}/mailbox endpoint in vehicles.ts (line 444). Calls `updateVehicleMailbox()` in vehicleService.ts (line 216-226). Requires Admin or SuperAdmin role. |
| 5 | Checkpoint explicitly surfaces the auto-provisioning technical constraint (Graph API cannot create mailboxes) | VERIFIED | plan 05-02-PLAN.md Task 2 documents this explicitly. PowerShell script header comment states "Graph API cannot create Exchange mailboxes -- this PowerShell script is the only supported provisioning path" (provision-vehicle-mailbox.ps1 line 59). |
| 6 | An admin endpoint exists to backfill calendar events for existing bookings | VERIFIED | POST /api/backoffice/calendar/backfill in calendarAdmin.ts (line 181). Requires SuperAdmin role. Queries bookings with null event IDs and status IN ('Confirmed', 'Active', 'Overdue'). Processes in batches of 10 with 2-second delay. |
| 7 | Vehicle creation flow stores resourceMailboxEmail when provided | VERIFIED | VehicleInputSchema includes `resourceMailboxEmail: z.string().email().max(255).nullable().optional()` (Vehicle.ts:15). createVehicle and updateVehicle in vehicleService.ts both pass resourceMailboxEmail to SQL INSERT/UPDATE. |

**Score: 7/7 plan 02 truths verified**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/services/calendarService.ts` | Calendar event CRUD via Graph API, exports syncBookingToCalendars | VERIFIED | 547 lines. All 6 functions: escapeHtml, buildVehicleEventBody, buildEmployeeEventBody, buildStatusUpdateBody, createCalendarEvent, updateCalendarEvent. syncBookingToCalendars exported (line 253). |
| `api/src/sql/schema.sql` | Schema additions for calendar integration, contains resourceMailboxEmail | VERIFIED | Phase 5 section (lines 99-106). Three ALTER TABLE statements: Vehicles ADD resourceMailboxEmail, Bookings ADD vehicleCalendarEventId, Bookings ADD employeeCalendarEventId. |
| `api/src/models/Booking.ts` | IBooking with calendar event ID fields, contains vehicleCalendarEventId | VERIFIED | IBooking has vehicleCalendarEventId: string | null (line 63) and employeeCalendarEventId: string | null (line 64). IAvailableVehicle has resourceMailboxEmail: string | null (line 85). |
| `scripts/provision-vehicle-mailbox.ps1` | Exchange equipment mailbox provisioning script, contains New-Mailbox -Equipment | VERIFIED | 219 lines. Contains New-Mailbox, Set-CalendarProcessing, Set-MailboxFolderPermission, optional room list creation. Outputs generated email address with next-step instructions. |
| `api/src/functions/calendarAdmin.ts` | Admin calendar provisioning and backfill endpoints | VERIFIED | 186 lines. provisioningStatus (GET) and backfillCalendarEvents (POST) functions registered. Admin role guard on status, SuperAdmin guard on backfill. |
| `api/src/services/vehicleService.ts` | Updated vehicle service with resourceMailboxEmail support | VERIFIED | updateVehicleMailbox function (lines 216-226). resourceMailboxEmail in createVehicle (line 133), updateVehicle (line 167), getVehicles SELECT (line 72), getVehicleById SELECT (line 100). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/services/calendarService.ts` | `api/src/services/graphService.ts` | getGraphClient() for Graph API authentication | WIRED | `import { getGraphClient } from './graphService.js'` (line 12). Called in createCalendarEvent (line 153) and updateCalendarEvent (line 199). getGraphClient is exported from graphService.ts (line 24). |
| `api/src/functions/bookings.ts` | `api/src/services/calendarService.ts` | fire-and-forget calendar sync after booking mutations | WIRED | `import { syncBookingToCalendars } from '../services/calendarService.js'` (line 38). Called with .catch() at lines 236, 299, 352, 418. All 4 employee-facing mutation endpoints covered. |
| `api/src/functions/adminBookings.ts` | `api/src/services/calendarService.ts` | fire-and-forget calendar sync after admin cancel | WIRED | `import { syncBookingToCalendars } from '../services/calendarService.js'` (line 22). Called with .catch() at line 145, passing cancelReason. |
| `api/src/functions/calendarAdmin.ts` | `api/src/services/calendarService.ts` | syncBookingToCalendars for backfill | WIRED | `import { syncBookingToCalendars } from '../services/calendarService.js'` (line 20). Called in backfillCalendarEvents loop (line 137). |
| `scripts/provision-vehicle-mailbox.ps1` | Exchange Online | New-Mailbox -Equipment PowerShell cmdlet | VERIFIED (script) | New-Mailbox -Equipment at line 101. Set-CalendarProcessing at line 121. Set-MailboxFolderPermission at line 140. Runtime verification requires live Exchange Online tenant. |
| `api/src/functions/calendarAdmin.ts` | `api/src/index.ts` | import registration in entry point | WIRED | `import './functions/calendarAdmin.js'` at index.ts line 10. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| M365-01 | 05-01, 05-02 | Each vehicle has an Exchange equipment mailbox with a resource calendar | SATISFIED | PowerShell script provisions equipment mailbox. PATCH /api/backoffice/vehicles/{id}/mailbox links mailbox to vehicle. resourceMailboxEmail stored in Vehicles table. calendarService creates events on the resource mailbox when set. |
| M365-02 | 05-01 | Booking creates a calendar event on the vehicle's resource calendar (visible in Outlook) | SATISFIED | syncBookingToCalendars('created') creates POST /users/{resourceMailboxEmail}/events with showAs='busy', booking details, vehicle info, and deep link. Event ID stored as vehicleCalendarEventId. |
| M365-03 | 05-01 | Booking creates a calendar event on the employee's personal Outlook calendar | SATISFIED | syncBookingToCalendars('created') creates POST /users/{userEmail}/events with showAs='free', isReminderOn=true, 30-minute reminder, and deep link. Event ID stored as employeeCalendarEventId. |

**No orphaned requirements.** REQUIREMENTS.md maps M365-01, M365-02, M365-03 to Phase 5. All three are claimed by both plan 05-01 and 05-02. M365-04 (locations synced from Entra ID) is mapped to Phase 2 -- not a Phase 5 requirement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected in any phase 5 file. |

TypeScript compilation: `npx tsc --noEmit` exits with no errors.

Commits verified in git log:
- `b032770` feat(05-01): calendar service and schema migration
- `d91e8cc` feat(05-01): booking endpoint wiring
- `bc6adcd` feat(05-02): admin provisioning, calendarAdmin, vehicle mailbox

### Human Verification Required

All automated checks pass. The following items require a live M365 tenant to verify.

#### 1. Employee and Vehicle Calendar Events Created on Booking

**Test:** Create a booking via POST /api/bookings for a vehicle that has resourceMailboxEmail set.
**Expected:** Vehicle resource calendar has event `{EmployeeName} - {Make} {Model} ({Plate})` showing as Busy. Employee personal calendar has `Vehicle Rental: {Make} {Model} ({Plate})` showing as Free with a 30-minute reminder. Both have HTML body with booking details and deep link.
**Why human:** Requires live M365 tenant with Calendars.ReadWrite application permission granted and Exchange equipment mailbox provisioned.

#### 2. Cancellation Updates Both Calendar Events

**Test:** Cancel the booking created above (DELETE /api/bookings/{id} or admin cancel).
**Expected:** Both Outlook events now have `[CANCELLED]` prefix in subject and a cancellation banner in the body. Events are not deleted.
**Why human:** Requires live Graph API PATCH call to Exchange calendars.

#### 3. Checkout and Return Update Calendar Events

**Test:** Check out a booking (PATCH /api/bookings/{id}/checkout), then return it (PATCH /api/bookings/{id}/return).
**Expected:** After checkout, both events show `[IN USE]` in subject. After return, both events show `[RETURNED]` in subject.
**Why human:** Requires live Graph API PATCH call to Exchange calendars.

#### 4. Graceful Skip When Vehicle Has No Mailbox

**Test:** Create a booking for a vehicle where resourceMailboxEmail is NULL.
**Expected:** Booking succeeds (HTTP 201). Employee calendar event is created normally. No vehicle resource calendar event is created. No error is returned from the booking endpoint.
**Why human:** Requires live Graph API call to confirm the conditional skip at calendarService.ts line 308 functions correctly in production.

#### 5. Admin Provisioning Status Dashboard

**Test:** Call GET /api/backoffice/calendar/status as an Admin.
**Expected:** Response includes total vehicle count, count with/without resourceMailboxEmail, and full vehicle list with provisioning status per vehicle.
**Why human:** Requires running API with connected Azure SQL database.

#### 6. Backfill Migration Endpoint

**Test:** With some bookings in the database that have NULL vehicleCalendarEventId and NULL employeeCalendarEventId, call POST /api/backoffice/calendar/backfill as a SuperAdmin.
**Expected:** Returns `{ total: N, synced: M, failed: F }`. After completion, the previously-missing bookings now have calendar events in Outlook.
**Why human:** Requires live M365 tenant, running API, and database with qualifying bookings.

### Gaps Summary

No gaps identified. All 15 observable truths across both plans are verified at code level (existence, substance, and wiring). TypeScript compiles without errors. All three commits exist in git history with correct file changes. The only items requiring attention are live-tenant integration tests that cannot be verified by code inspection.

---

_Verified: 2026-02-25T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
