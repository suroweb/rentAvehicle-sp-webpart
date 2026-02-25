---
phase: 03-core-booking-flow
verified: 2026-02-23T14:00:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification: false
human_verification:
  - test: "Open SPFx workbench, navigate to Browse Vehicles, select location/date/time, click Search — verify card grid renders with photo, make/model/year, category badge, capacity, plate, green availability dot"
    expected: "Card grid appears with 2-3 columns on desktop and correct vehicle info on each card"
    why_human: "Visual layout and CSS grid cannot be verified programmatically"
  - test: "Verify location dropdown is pre-selected to the user's Entra ID office location before clicking Search"
    expected: "Dropdown shows the employee's office location as the default selection"
    why_human: "Requires a real authenticated SPFx session with officeLocation set in Entra ID"
  - test: "Click a vehicle card, verify detail page: back button, hero image (or Car icon placeholder), specs grid, 7-day availability strip (8:00-20:00 coloured blocks), and inline booking form with timezone label"
    expected: "All detail page sections render correctly with timezone abbreviation (e.g., EET) visible next to time dropdowns"
    why_human: "Visual appearance and Intl timezone formatting output require human inspection"
  - test: "Complete a booking: select dates/times, click Review Booking, verify review panel shows vehicle name, location, start/end in vehicle timezone with abbreviation, then click Confirm Booking"
    expected: "Booking created, success bar shows 'Booking confirmed!' with 'View My Bookings' link"
    why_human: "Requires live database and full booking flow"
  - test: "Try to book the same vehicle for the same slot a second time"
    expected: "Error message 'This slot was just booked by someone else' appears, availability strip refreshes"
    why_human: "Requires concurrent booking attempt against live database with SERIALIZABLE transaction in effect"
  - test: "Navigate to My Bookings, verify three tabs (Upcoming, Active, Past) with counts, each booking entry shows photo thumbnail, make/model, plate, category badge, start/end in vehicle timezone, location"
    expected: "Booked vehicle appears in Upcoming tab with cancel button visible; times shown in vehicle's location timezone not browser timezone"
    why_human: "Requires live data and timezone correctness can only be visually confirmed"
  - test: "Click cancel on an upcoming booking, verify 'Are you sure you want to cancel this booking?' dialog, confirm, verify booking moves to Past tab"
    expected: "ConfirmDialog appears, after confirm the booking list refreshes and entry is gone from Upcoming"
    why_human: "Cancel flow interaction requires manual testing"
  - test: "Cancel all bookings and navigate to My Bookings — verify global empty state"
    expected: "'No bookings yet' message with a 'Book a Vehicle' primary button that navigates to Browse"
    why_human: "Empty state requires no active bookings in the database"
  - test: "Resize browser to ~375px width, verify vehicle cards stack 1-per-row and bottom tab bar shows Browse and My Bookings"
    expected: "Single-column card layout, bottom tab navigation visible"
    why_human: "Responsive layout requires visual inspection at mobile viewport"
---

# Phase 3: Core Booking Flow Verification Report

**Phase Goal:** Employees can find an available vehicle at their location and book it with hourly precision, with the system preventing double-bookings and displaying all times correctly for the vehicle's timezone
**Verified:** 2026-02-23T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bookings table exists in Azure SQL with UTC DATETIME2 columns, status CHECK constraint, and performance indexes | VERIFIED | `api/src/sql/schema.sql` lines 57-77: full DDL with CHECK constraints and 3 indexes |
| 2 | Locations table has an IANA timezone column defaulting to UTC | VERIFIED | `api/src/sql/schema.sql` line 54: `ALTER TABLE Locations ADD timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC'` |
| 3 | Creating a booking within a SERIALIZABLE transaction prevents double-bookings at the database level | VERIFIED | `api/src/services/bookingService.ts` line 155: `await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)` with overlap check before INSERT |
| 4 | Available vehicles query excludes vehicles with overlapping confirmed/active bookings | VERIFIED | `bookingService.ts` lines 53-59: NOT EXISTS subquery with half-open interval `b.startTime < @endTime AND b.endTime > @startTime` |
| 5 | Employee can call /api/bookings to create a booking and /api/bookings/my to list their bookings | VERIFIED | `api/src/functions/bookings.ts` lines 313-326: POST bookings + GET bookings/my registered with `app.http()` |
| 6 | Employee can call /api/bookings/{id} DELETE to cancel their own upcoming booking | VERIFIED | `api/src/functions/bookings.ts` lines 327-332: DELETE bookings/{id} registered; cancelBooking validates ownership and startTime > now |
| 7 | /api/me returns officeLocation for location auto-detection on the frontend | VERIFIED | `api/src/functions/me.ts` line 28: `officeLocation: user.officeLocation \|\| null` in response |
| 8 | Employee sees a card grid of available vehicles filtered by location, date/time range, and category | VERIFIED | `VehicleBrowse.tsx` line 378-389: `<div className={styles.cardGrid}>` with VehicleCard map; SCSS uses `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` |
| 9 | Employee's location is auto-detected from their Entra ID profile and pre-selected | VERIFIED | `VehicleBrowse.tsx` lines 95-107: matches `userOfficeLocation` against locations list, calls `setSelectedLocationId(match.id)`; AppShell passes `auth.user.officeLocation` |
| 10 | Vehicle cards show photo, make/model/year, category badge, capacity, license plate, and availability indicator | VERIFIED | `VehicleCard.tsx` lines 40-78: complete card with all required elements including green availability dot |
| 11 | Employee can click a vehicle card to see the full detail page with hero image, specs, and availability strip | VERIFIED | `VehicleDetail.tsx` lines 141-217: hero image, full specs grid, `<AvailabilityStrip>` component rendered |
| 12 | Employee can book a vehicle from the detail page using date pickers + hour dropdowns with timezone label | VERIFIED | `BookingForm.tsx` lines 255-261: `label={'Start time (' + tz.timezoneAbbr + ')'}` on dropdowns; DatePicker + Dropdown per row |
| 13 | Booking shows a review step before confirming with vehicle, dates/times, location, and timezone | VERIFIED | `BookingForm.tsx` lines 167-219: review panel shows vehicle, location, start/end via `tz.formatDateTime()`, timezone label |
| 14 | On booking conflict, employee sees 'This slot was just booked by someone else' error | VERIFIED | `BookingForm.tsx` lines 143-146: `CONFLICT:` prefix detected, sets error message; `ApiService.ts` `postWithConflict` throws `CONFLICT:` prefixed error on 409 |
| 15 | All displayed times are in the vehicle's location timezone, not the browser's timezone | VERIFIED | `useTimezone.ts`: `Intl.DateTimeFormat` with `timeZone` option; `BookingForm`, `BookingEntry`, `AvailabilityStrip` all use `useTimezone(locationTimezone)` |
| 16 | Employee can view their bookings organised as Upcoming, Active, and Past tabs | VERIFIED | `MyBookings.tsx` lines 263-291: Fluent UI `Pivot` with three `PivotItem` tabs; `categorizeBookings()` derives status from time comparison |
| 17 | Upcoming bookings have a cancel button with 'Are you sure?' confirmation dialog | VERIFIED | `MyBookings.tsx` line 295-302: `<ConfirmDialog>` with "Are you sure you want to cancel this booking?"; `BookingEntry.tsx` renders cancel button when `showCancel=true` |

**Score:** 17/17 truths verified

---

### Required Artifacts

#### Plan 03-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/sql/schema.sql` | Bookings DDL + Locations.timezone ALTER | VERIFIED | Contains full Bookings table with CHECK constraints, 3 indexes, and ALTER TABLE |
| `api/src/models/Booking.ts` | BookingInputSchema + IBooking + IAvailableVehicle + IVehicleAvailabilitySlot | VERIFIED | All 4 exports present; hourly precision validated via `getUTCMinutes() === 0` |
| `api/src/services/bookingService.ts` | 6 booking CRUD functions | VERIFIED | All 6 functions: getAvailableVehicles, getVehicleDetail, getVehicleAvailability, createBooking, getMyBookings, cancelBooking |
| `api/src/functions/bookings.ts` | 6 employee-facing HTTP endpoints | VERIFIED | All 6 registered with `app.http()`: vehicles/available, vehicles/{id}/detail, vehicles/{id}/availability, bookings, bookings/my, bookings/{id} DELETE |
| `api/src/functions/me.ts` | officeLocation in response | VERIFIED | Line 28 returns `officeLocation: user.officeLocation \|\| null` |
| `api/src/index.ts` | bookings module import | VERIFIED | Line 8: `import './functions/bookings.js'` |

#### Plan 03-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `spfx/src/webparts/rentaVehicle/models/IBooking.ts` | IBooking, IAvailableVehicle, IVehicleAvailabilitySlot, IBookingInput | VERIFIED | All 4 interfaces exported |
| `spfx/src/webparts/rentaVehicle/hooks/useTimezone.ts` | useTimezone hook + localToUtcIso | VERIFIED | Hook uses `useMemo` + `Intl.DateTimeFormat`; `localToUtcIso` exported as standalone function |
| `spfx/src/webparts/rentaVehicle/services/ApiService.ts` | 7 new booking methods | VERIFIED | browseAvailableVehicles, getVehicleDetail, getVehicleAvailability, createBooking, getMyBookings, cancelBooking, getLocationsPublic all present |
| `spfx/src/webparts/rentaVehicle/components/VehicleBrowse/VehicleBrowse.tsx` | Browse page with VehicleBrowse component | VERIFIED | Full implementation with filters, auto-detection, card grid, Shimmer loading |
| `spfx/src/webparts/rentaVehicle/components/VehicleBrowse/VehicleCard.tsx` | VehicleCard component | VERIFIED | Photo/placeholder, make/model/year, category badge, capacity, plate, availability dot |
| `spfx/src/webparts/rentaVehicle/components/VehicleDetail/VehicleDetail.tsx` | VehicleDetail page | VERIFIED | Hero image, specs grid, back nav, AvailabilityStrip, BookingForm, success message |
| `spfx/src/webparts/rentaVehicle/components/VehicleDetail/AvailabilityStrip.tsx` | 7-day availability visualization | VERIFIED | Renders 7 day columns with 8:00-20:00 hour blocks; booked/free colored; tooltips |
| `spfx/src/webparts/rentaVehicle/components/VehicleDetail/BookingForm.tsx` | Selection -> review -> confirm form | VERIFIED | Three form states; timezone labels on dropdowns; 409 conflict handling |

#### Plan 03-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `spfx/src/webparts/rentaVehicle/components/MyBookings/MyBookings.tsx` | Tabbed booking list | VERIFIED | Pivot with Upcoming/Active/Past tabs, booking categorization, cancel flow, empty state |
| `spfx/src/webparts/rentaVehicle/components/MyBookings/BookingEntry.tsx` | Individual booking card | VERIFIED | Photo thumbnail, vehicle info, timezone-aware dates via `useTimezone`, cancel button |
| `spfx/src/webparts/rentaVehicle/components/AppShell/AppShell.tsx` | Routing for browse/detail/myBookings | VERIFIED | case 'browse' with `selectedVehicleId` sub-navigation, case 'myBookings', `handleNavigate` resets vehicleId |
| `spfx/src/webparts/rentaVehicle/models/IUser.ts` | officeLocation field | VERIFIED | Line 8: `officeLocation?: string \| null` in IUser interface |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bookings.ts` | `bookingService.ts` | import and function calls | VERIFIED | Line 16-30: all 6 service functions imported and called in handlers |
| `bookingService.ts` | `database.ts` | `getPool()` for SQL queries | VERIFIED | Line 9: `import { getPool } from './database.js'`; used in every function |
| `bookingService.ts` | mssql SERIALIZABLE | `sql.ISOLATION_LEVEL.SERIALIZABLE` | VERIFIED | Line 155: `await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)` |
| `index.ts` | `functions/bookings.ts` | import for function registration | VERIFIED | Line 8: `import './functions/bookings.js'` |
| `VehicleBrowse.tsx` | `ApiService` | `browseAvailableVehicles` call | VERIFIED | Line 220: `apiService.browseAvailableVehicles(selectedLocationId, startTimeUtc, endTimeUtc, selectedCategoryId)` |
| `VehicleDetail.tsx` | `ApiService` | `getVehicleDetail` and `getVehicleAvailability` | VERIFIED | Lines 42-43: `Promise.all([apiService.getVehicleDetail, apiService.getVehicleAvailability])` |
| `BookingForm.tsx` | `ApiService` | `createBooking` with 409 conflict | VERIFIED | Line 133: `apiService.createBooking({...})`; CONFLICT prefix detected at line 143 |
| `VehicleCard.tsx` | `VehicleBrowse.tsx` | `onSelect` callback | VERIFIED | VehicleCard prop `onSelect` called via `handleClick`; wired in VehicleBrowse line 383 |
| `useTimezone.ts` | `Intl.DateTimeFormat` | native browser timezone API | VERIFIED | Lines 43-64: three `Intl.DateTimeFormat` instances with `timeZone` option |
| `MyBookings.tsx` | `ApiService` | `getMyBookings` and `cancelBooking` | VERIFIED | Lines 83, 149: both calls present in MyBookings component |
| `AppShell.tsx` | `VehicleBrowse.tsx` | `case 'browse'` | VERIFIED | Lines 85-112: case 'browse' renders VehicleBrowse with `onNavigateToDetail` |
| `AppShell.tsx` | `VehicleDetail.tsx` | `VehicleDetail` component | VERIFIED | Lines 87-98: VehicleDetail rendered when `selectedVehicleId !== null` |
| `AppShell.tsx` | `MyBookings.tsx` | `case 'myBookings'` | VERIFIED | Lines 113-126: case 'myBookings' renders MyBookings |
| `MyBookings.tsx` | `useTimezone` hook | timezone formatting | VERIFIED | `BookingEntry.tsx` line 22: `useTimezone(booking.locationTimezone \|\| 'UTC')` |
| `AuthContext.tsx` | officeLocation in IUser | passthrough from `/api/me` | VERIFIED | `getMe()` returns `Promise<IUser>` cast directly from JSON; `/api/me` now includes `officeLocation`; IUser has `officeLocation?: string \| null`. JSON is not selectively mapped — field is automatically populated. |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| BOOK-01 | 03-01, 03-02 | Employee can browse available vehicles filtered by location, date/time range, and category | VERIFIED | VehicleBrowse filter bar + browseAvailableVehicles API; NOT EXISTS subquery in backend |
| BOOK-02 | 03-01, 03-02 | Employee can view vehicle details (make, model, year, plate, category, capacity, photo) | VERIFIED | VehicleDetail specs grid shows all fields; getVehicleDetail API returns joined data |
| BOOK-03 | 03-01, 03-02 | Employee can book a specific vehicle with start/return date/time (hourly precision) | VERIFIED | BookingInputSchema validates `getUTCMinutes() === 0`; BookingForm uses date+hour dropdowns |
| BOOK-04 | 03-01, 03-02 | System prevents double-booking via database-level constraints | VERIFIED | SERIALIZABLE transaction in createBooking; 409 conflict returned and surfaced to UI |
| BOOK-05 | 03-01, 03-03 | Employee can view their bookings (upcoming, active, past) | VERIFIED | MyBookings with 3 tabs; getMyBookings API with full join data |
| BOOK-06 | 03-01, 03-02, 03-03 | All times displayed in user's local timezone (stored as UTC) | VERIFIED | useTimezone hook using Intl.DateTimeFormat with IANA timezone; localToUtcIso for input conversion |

No orphaned requirements found. All 6 BOOK-0x IDs declared across plan frontmatter are accounted for in the codebase.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `VehicleBrowse.tsx:290` | `placeholder="Select a location"` | Info | Legitimate UI dropdown placeholder text — not a stub |
| `VehicleCard.tsx:49` | `cardPlaceholder` / Car icon | Info | Legitimate photo fallback — not a stub |
| `AuthContext.tsx` (general) | `officeLocation` not explicitly mapped in AuthContext | Info | Non-blocking: `getMe()` returns `Promise<IUser>` and JSON response is directly cast; field flows through automatically since `/api/me` returns it and `IUser` declares it. No explicit mapping needed. |

No blocker anti-patterns found. No stub implementations detected. No TODO/FIXME/placeholder comments in implementation code.

---

### Human Verification Required

#### 1. Vehicle Browse — Card Grid and Filters

**Test:** Open SPFx workbench, navigate to "Browse Vehicles", select a location, date range, and click Search.
**Expected:** Vehicle cards appear in a 2-3 column grid (desktop). Each card shows photo (or Car icon), make/model/year, category badge, capacity (seats), license plate, green "Available" dot.
**Why human:** Visual layout, CSS grid rendering, and card content correctness require browser inspection.

#### 2. Location Auto-Detection

**Test:** Log in as an employee with officeLocation set in Entra ID, navigate to Browse Vehicles.
**Expected:** Location dropdown is pre-selected to the employee's office location before any interaction.
**Why human:** Requires real Entra ID SSO session with populated officeLocation attribute.

#### 3. Vehicle Detail Page Layout

**Test:** Click a vehicle card, inspect the detail page.
**Expected:** Back button at top, full-width hero image (or Car icon placeholder), specs grid with make/model/year/plate/category/capacity/location, 7-day availability strip (8:00-20:00 coloured blocks), inline booking form with timezone labels (e.g., "Start time (EET)").
**Why human:** Visual layout and timezone abbreviation display require browser inspection.

#### 4. Complete Booking Flow with Timezone Correctness

**Test:** Select a start date/time and end date/time in the booking form, click Review Booking, inspect review panel, click Confirm Booking.
**Expected:** Review panel shows vehicle name, location, start and end times formatted in vehicle's timezone (not browser timezone), timezone abbreviation. Success bar shows "Booking confirmed!" with "View My Bookings" link.
**Why human:** Requires live database; timezone correctness must be confirmed visually (compare displayed time against the vehicle's IANA timezone).

#### 5. Double-Booking Prevention — User-Facing Error

**Test:** Attempt to book a vehicle for a slot that is already booked (either repeat same booking or have two tabs).
**Expected:** Error message "This slot was just booked by someone else" appears as a red MessageBar. Availability strip refreshes showing the booked slot.
**Why human:** Requires concurrent or repeat booking attempt against live Azure SQL.

#### 6. My Bookings — Tabs and Entry Layout

**Test:** Navigate to My Bookings after creating a booking.
**Expected:** Three tabs with counts: "Upcoming (1)", "Active (0)", "Past (0)". Booking entry shows vehicle photo thumbnail, make/model, plate, category badge, start/end in vehicle timezone with abbreviation, location name. Cancel button visible on upcoming entries.
**Why human:** Requires live data; timezone display requires visual confirmation.

#### 7. Cancel Flow — Confirmation Dialog

**Test:** Click cancel on an upcoming booking.
**Expected:** ConfirmDialog appears with "Are you sure you want to cancel this booking?" and two buttons. Confirming moves the booking to the Past tab and re-fetches the list.
**Why human:** Dialog interaction and list refresh require manual testing.

#### 8. Global Empty State

**Test:** Ensure all bookings are cancelled, then navigate to My Bookings.
**Expected:** "No bookings yet" heading with descriptive text and a "Book a Vehicle" primary button. Clicking the button navigates to Browse page.
**Why human:** Requires no active bookings in the database.

#### 9. Responsive Mobile Layout

**Test:** Resize browser to ~375px width.
**Expected:** Vehicle cards stack to 1-per-row. Bottom tab bar visible with Browse and My Bookings items.
**Why human:** CSS responsive layout requires visual inspection at mobile viewport width.

---

### Gaps Summary

No gaps found. All automated checks passed. The phase backend and frontend are substantively implemented and correctly wired end-to-end. The 9 human verification items above are required because they depend on live database connectivity, real Entra ID SSO, visual layout inspection, and timezone display correctness — none of which can be verified programmatically.

**Notable implementation quality observed:**

- SERIALIZABLE transaction in `createBooking` correctly uses range locks with the overlap check before INSERT, and handles SQL Server deadlock error 1205 as a conflict (not a 500).
- `localToUtcIso` uses a probe-date offset strategy compatible with ES5 (no `formatToParts`, no `padStart`) — a deliberate fix documented in 03-02-SUMMARY.md.
- `postWithConflict` in ApiService uses a `CONFLICT:` prefix convention so BookingForm can distinguish 409 booking conflicts from other API errors without coupling to HTTP status codes.
- `AuthContext` does not explicitly map `officeLocation` — it casts the full JSON response as `IUser` directly. This works because `IUser` declares `officeLocation?: string | null` and `/api/me` now returns the field. If the API response field name ever diverged from the interface field name, this silent casting would silently break; however, the current implementation is consistent.

---

*Verified: 2026-02-23T14:00:00Z*
*Verifier: Claude (gsd-verifier)*
