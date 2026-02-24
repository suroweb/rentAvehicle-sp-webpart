# Phase 4: Booking Lifecycle and Admin Oversight - Research

**Researched:** 2026-02-24
**Domain:** Booking state machine, calendar timeline visualization, admin CRUD, SPFx/Fluent UI v8
**Confidence:** HIGH

## Summary

Phase 4 extends the existing Phase 3 booking infrastructure with four major capabilities: (1) a visual calendar timeline for vehicle availability, (2) check-out and check-in (return) lifecycle operations, (3) smart slot suggestions on booking conflict, and (4) an admin all-bookings view with cancel/override capability.

The codebase is well-established from Phases 1-3 with clear patterns: Azure Functions v4 HTTP handlers + mssql service layer on the backend, React 17.0.1 + Fluent UI v8 components with CSS Modules on the frontend, and an ApiService class bridging the two. The existing Bookings table already has the `status` column with `Confirmed | Active | Completed | Cancelled` values, though Phase 3 only used `Confirmed` and `Cancelled`. Phase 4 activates the full state machine. The existing `AvailabilityStrip` component provides a compact 7-day grid; the new calendar timeline is a separate day-view component with hourly rows per vehicle. No new npm dependencies are required -- Fluent UI v8's existing components (DetailsList, Dialog, TextField, DatePicker, Dropdown, CommandBar) and the project's custom CSS grid patterns cover all UI needs.

**Primary recommendation:** Build the calendar timeline as a custom CSS Grid component (one row per vehicle, hourly columns, color-coded booking blocks) using the existing `getVehicleAvailability`-style query pattern expanded to return all vehicles at a location. Add `checkedOutAt`, `checkedInAt`, and `cancelReason` columns to the Bookings table. Implement check-out/check-in as status-transition PATCH endpoints with time-window validation. Build suggestion logic as a server-side query returning nearby available slots and alternative vehicles. Build admin view using Fluent UI DetailsList with the established filter pattern from FleetManagement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Calendar timeline design:** Day view with hourly slots -- one row per vehicle at the selected location. Location filter determines which vehicles appear. Color-coded blocks spanning booked hours, showing booker's name on the block. Different colors for own bookings vs others' bookings. Clicking a free slot opens the booking form pre-filled with vehicle, date, and start time.
- **Check-in/out workflow:** Check Out and Return buttons appear on the booking card in My Bookings page. Check Out button becomes available 30 minutes before the scheduled start time. If no checkout within 1 hour of start time, booking auto-cancels (frees the vehicle). If no return by end time, booking status becomes "overdue" -- visible to admin. Return is a simple confirmation tap -- no damage reporting (that's v2: MODR-01).
- **Slot suggestions:** When a booking attempt conflicts, show both nearby available times for the same vehicle AND alternative vehicles at the same location for the original time. Suggestions appear inline below the conflict message -- no modal, no page change. Show up to 3 alternatives (mix of time shifts and vehicle alternatives). Suggestions triggered only on booking conflict, not proactively on the availability view.
- **Admin booking control:** All-bookings view is a sortable table with filters for location, status, date range, and employee. Cancel flow: confirmation dialog with a required reason field; reason is stored and displayed to the affected employee. Cancelled booking shows as "Cancelled by Admin" with the reason on the employee's My Bookings page (in-app only -- email notification is Phase 6). Admin cannot create bookings on behalf of employees -- cancel only.

### Claude's Discretion
- Calendar timeline component implementation (library choice, rendering approach)
- Exact color palette for booking status blocks
- Auto-cancel scheduling mechanism (timer-based, cron, or on-access check)
- Table pagination and default sort order for admin view
- Suggestion ranking algorithm (nearest time first vs same-category vehicle first)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOOK-07 | Availability shown as both filterable list and visual calendar timeline | Calendar timeline component architecture, CSS Grid rendering, location-filtered vehicle query returning bookings per vehicle |
| BOOK-08 | Employee can check out a vehicle at pickup time | Status transition endpoint (Confirmed -> Active), 30-min-before window validation, auto-cancel scheduling, BookingEntry UI with Check Out button |
| BOOK-09 | Employee can check in (return) a vehicle through the system | Status transition endpoint (Active -> Completed), BookingEntry UI with Return button, checkedInAt timestamp |
| BOOK-10 | When desired slot is taken, system suggests nearest available slot or alternative vehicles | Server-side suggestion query returning time-shifted and vehicle-alternative options, conflict response enhancement, inline suggestion UI |
| ADMN-01 | Admin can view all bookings across all locations | getAllBookings service with location/status/date/employee filters, admin endpoint with role guard, DetailsList-based AllBookings component |
| ADMN-02 | Admin can cancel/override employee bookings (with notification to affected employee) | Admin cancel endpoint with reason field, cancelReason DB column, in-app display of admin cancellation reason on employee's booking card |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 17.0.1 (exact pin) | UI framework | SPFx 1.22 requirement -- React 18 breaks SPFx |
| @fluentui/react | ^8.106.4 | UI component library | SPFx blessed -- v9 has rendering issues in SPFx context |
| mssql | ^12.2.0 | Azure SQL client | Already in use, SERIALIZABLE transactions for double-booking prevention |
| zod | ^3.0.0 | Input validation | Already in use for all API endpoint validation |
| @azure/functions | ^4.11.2 | HTTP endpoint framework | Azure Functions v4 Node.js, already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.DateTimeFormat | (browser built-in) | Timezone conversion | Already established pattern via useTimezone hook |
| CSS Modules (.module.scss) | (build tooling) | Scoped component styles | All existing components use this pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS Grid timeline | react-calendar-timeline or vis-timeline | External libs add bundle size, may conflict with SPFx Heft build, React 17 compat risk. Custom CSS Grid is ~200 lines, fully controlled, no dependency risk. |
| Custom table with DetailsList | @pnp/spfx-controls-react ListView | pnp controls compat with SPFx 1.22 Heft build was flagged as a concern in STATE.md. DetailsList is part of @fluentui/react already installed. |
| On-access auto-cancel check | Azure Functions Timer Trigger | Timer trigger adds infrastructure complexity (cron configuration, cold start costs). On-access check is simpler: when getMyBookings or getVehicleAvailability runs, check and auto-cancel expired bookings in the same query. Slight delay is acceptable since the 1-hour window is already generous. |

**Installation:**
```bash
# No new packages required -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── functions/
│   ├── bookings.ts            # Extend: add check-out, check-in, suggestions endpoints
│   └── adminBookings.ts       # NEW: admin all-bookings list, admin cancel
├── services/
│   └── bookingService.ts      # Extend: checkOut, checkIn, getSuggestions, getAllBookings, adminCancel, autoExpireBookings
├── models/
│   └── Booking.ts             # Extend: new schemas, IBookingSuggestion interface
└── sql/
    └── schema.sql             # Extend: ALTER TABLE add checkedOutAt, checkedInAt, cancelReason, overdue status

spfx/src/webparts/rentaVehicle/
├── components/
│   ├── AvailabilityTimeline/
│   │   ├── AvailabilityTimeline.tsx      # NEW: day-view calendar grid
│   │   └── AvailabilityTimeline.module.scss
│   ├── MyBookings/
│   │   ├── BookingEntry.tsx              # EXTEND: Check Out, Return buttons, admin cancel reason
│   │   └── MyBookings.tsx               # EXTEND: integrate lifecycle buttons
│   ├── AllBookings/
│   │   ├── AllBookings.tsx              # NEW: admin all-bookings table
│   │   └── AllBookings.module.scss
│   └── VehicleDetail/
│       └── BookingForm.tsx              # EXTEND: inline conflict suggestions
├── models/
│   └── IBooking.ts                      # EXTEND: IBookingSuggestion, updated status type
└── services/
    └── ApiService.ts                    # EXTEND: new API methods
```

### Pattern 1: Booking Status State Machine
**What:** The Bookings table status column represents a finite state machine with clearly defined transitions.
**When to use:** All status changes must go through validated transitions -- never allow arbitrary status updates.

```
Confirmed ──[check-out (30min before start)]──> Active
Confirmed ──[auto-cancel (1hr after start)]──> Cancelled (reason: "Auto-cancelled: no checkout")
Confirmed ──[employee cancel]──> Cancelled
Confirmed ──[admin cancel]──> Cancelled (with cancelReason)
Active ────[check-in (return)]──> Completed
Active ────[end time passes without return]──> Overdue
Overdue ───[check-in (return)]──> Completed
Overdue ───[admin cancel]──> Cancelled (with cancelReason)
```

**Database schema change:**
```sql
-- Phase 4: Booking Lifecycle
ALTER TABLE Bookings ADD checkedOutAt DATETIME2 NULL;
ALTER TABLE Bookings ADD checkedInAt DATETIME2 NULL;
ALTER TABLE Bookings ADD cancelReason NVARCHAR(500) NULL;

-- Update status CHECK constraint to include Overdue
ALTER TABLE Bookings DROP CONSTRAINT CK_Bookings_Status;  -- drop if named, else find constraint name
ALTER TABLE Bookings ADD CONSTRAINT CK_Bookings_Status
  CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled', 'Overdue'));
```

Note: The existing schema uses an inline CHECK on the status column without a named constraint. The implementor must identify or drop the existing unnamed constraint before adding the new one. Alternatively, use a migration approach that drops and recreates the column constraint.

### Pattern 2: On-Access Auto-Expire (Lazy Expiration)
**What:** Instead of a cron/timer, auto-cancel expired bookings when querying.
**When to use:** For the "1 hour after start time, auto-cancel if no checkout" rule and the "overdue" detection.

```typescript
// In bookingService.ts -- call before returning booking queries
async function autoExpireBookings(): Promise<void> {
  const pool = await getPool();
  const now = new Date();

  // Auto-cancel: Confirmed bookings where startTime + 1 hour < now
  await pool.request()
    .input('expiryCutoff', sql.DateTime2, new Date(now.getTime() - 60 * 60 * 1000))
    .query(`
      UPDATE Bookings
      SET status = 'Cancelled',
          cancelledAt = GETUTCDATE(),
          cancelledBy = 'SYSTEM',
          cancelReason = 'Auto-cancelled: no checkout within 1 hour of start time',
          updatedAt = GETUTCDATE()
      WHERE status = 'Confirmed'
        AND startTime < @expiryCutoff
    `);

  // Mark overdue: Active bookings where endTime < now
  await pool.request()
    .input('now', sql.DateTime2, now)
    .query(`
      UPDATE Bookings
      SET status = 'Overdue',
          updatedAt = GETUTCDATE()
      WHERE status = 'Active'
        AND endTime < @now
    `);
}
```

### Pattern 3: Calendar Timeline as CSS Grid
**What:** Custom day-view timeline component with vehicles as rows, hours as columns.
**When to use:** For BOOK-07 calendar timeline view.

```typescript
// AvailabilityTimeline.tsx - simplified structure
interface ITimelineBooking {
  bookingId: number;
  vehicleId: number;
  vehicleMake: string;
  vehicleModel: string;
  startTime: string;
  endTime: string;
  userName: string;
  isOwnBooking: boolean;
}

// CSS Grid: columns = hours (e.g. 8am-8pm = 12 columns)
// Each row = one vehicle
// Booking blocks span multiple columns based on start/end hour
// gridColumn: `${startHour - GRID_START + 1} / ${endHour - GRID_START + 1}`
```

The color scheme for booking blocks:
- Own bookings: `$color-primary` (#0078d4) -- consistent with Fluent UI theme
- Others' bookings: `#a19f9d` (Fluent UI neutralTertiary) -- visually distinct but not alarming
- Free slots: `#c8f7c5` or transparent with hover highlight
- Overdue: `#d13438` (Fluent UI red) for admin visibility

### Pattern 4: Conflict Suggestions Query
**What:** When a booking attempt returns 409 Conflict, also return suggestion data.
**When to use:** For BOOK-10 slot suggestions.

```typescript
// Instead of just { conflict: true }, return suggestions with the 409:
interface IBookingSuggestion {
  type: 'time_shift' | 'alt_vehicle';
  vehicleId: number;
  vehicleName: string;
  startTime: string;
  endTime: string;
  label: string; // e.g. "Same vehicle, 1 hour later" or "Toyota Corolla, same time"
}

// Server-side logic (bookingService.ts):
// 1. Find nearest free slots for the SAME vehicle (shift start forward/backward by 1h increments, up to 4h)
// 2. Find available vehicles at SAME location for the ORIGINAL time range
// 3. Mix and rank: nearest time shifts first, then alt vehicles, return top 3
```

### Pattern 5: Admin All-Bookings with DetailsList
**What:** Admin view using Fluent UI DetailsList (sortable, column-based table).
**When to use:** For ADMN-01 and ADMN-02.

```typescript
// Follows FleetManagement pattern: filter bar + table + dialogs
// Filters: location dropdown, status dropdown, date range, employee search text
// Columns: ID, Vehicle, Employee, Location, Start, End, Status, Actions
// Actions: Cancel button (opens dialog with required reason TextField)
```

The admin cancel endpoint differs from employee cancel:
- No ownership check (admin can cancel any booking)
- Requires cancelReason in request body
- Stores cancelReason in DB
- Sets cancelledBy to admin's userId
- Works on Confirmed, Active, and Overdue bookings (not Completed or already Cancelled)

### Anti-Patterns to Avoid
- **Client-side state machine enforcement:** Never trust the frontend to enforce status transitions. All transition validation happens server-side. The UI only shows available actions based on current status.
- **Optimistic status updates for lifecycle transitions:** Unlike simple cancel (which re-fetches), check-out and check-in must confirm server response before updating UI state. A failed check-out (e.g., booking already expired) must not show "Active" locally.
- **Timer-based auto-cancel in Azure Functions:** Timer triggers add cold-start latency and infrastructure config. Lazy expiration on query access is simpler and sufficient for this use case.
- **Building a timeline library:** The day-view timeline is a CSS Grid with ~150-200 lines of TSX. Do not import a full calendar library -- the complexity is in the data query, not the rendering.
- **Returning suggestions proactively on browse:** Per user decision, suggestions appear ONLY on booking conflict (409 response). Do not add suggestion logic to the browse/availability endpoints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table with columns | Custom table sorting | Fluent UI DetailsList with `onColumnClick` | Built-in sort, resize, accessibility. Already used in VehicleTable. |
| Date picker for filter ranges | Custom date input | Fluent UI DatePicker | Already used in VehicleBrowse and BookingForm |
| Confirmation dialog with reason field | Custom modal | Fluent UI Dialog + TextField | ConfirmDialog pattern established; extend with TextField for reason |
| Timezone display | Manual UTC offset calculation | useTimezone hook | Already established in Phase 3, handles DST correctly via Intl.DateTimeFormat |
| Filter bar with multiple dropdowns | Custom filter component | Dropdown + DatePicker composition | Same pattern as VehicleBrowse and FleetManagement filter bars |

**Key insight:** The project has strong established patterns from Phases 1-3. Every UI pattern needed in Phase 4 has a direct precedent. The work is extending existing components and adding new pages that follow existing page patterns, not inventing new approaches.

## Common Pitfalls

### Pitfall 1: Status CHECK Constraint Migration
**What goes wrong:** The existing Bookings table has an inline CHECK constraint on the status column that only allows `'Confirmed', 'Active', 'Completed', 'Cancelled'`. Adding `'Overdue'` requires modifying this constraint. If the implementor tries to INSERT or UPDATE a row with status='Overdue' before altering the constraint, the query silently fails or throws.
**Why it happens:** Inline CHECK constraints in SQL Server don't have user-assigned names, making them harder to reference in ALTER statements.
**How to avoid:** Use `sys.check_constraints` to find the auto-generated constraint name, then DROP and recreate. Include this in the schema migration SQL.
**Warning signs:** "The INSERT statement conflicted with the CHECK constraint" error when trying to set status to 'Overdue'.

### Pitfall 2: Race Condition on Check-Out
**What goes wrong:** Two browser tabs or devices trigger check-out for the same booking simultaneously. Both pass the "status === Confirmed" check, both update to Active.
**Why it happens:** Without transaction isolation, the read-check-update pattern is not atomic.
**How to avoid:** Use an optimistic concurrency pattern: `UPDATE Bookings SET status = 'Active', checkedOutAt = GETUTCDATE() WHERE id = @bookingId AND status = 'Confirmed'`. Check `rowsAffected` -- if 0, the booking was already checked out or cancelled. No SERIALIZABLE needed since we're updating a single row with a WHERE condition.
**Warning signs:** Duplicate check-out timestamps, or Active status set twice on the same booking.

### Pitfall 3: Timezone Mismatch in Calendar Timeline
**What goes wrong:** The calendar timeline shows hours in the wrong timezone. Bookings stored in UTC are displayed in the browser's local timezone instead of the location's timezone.
**Why it happens:** Using `new Date().getHours()` instead of Intl.DateTimeFormat with the location's timezone.
**How to avoid:** Use the same `useTimezone` hook and `Intl.DateTimeFormat` pattern established in AvailabilityStrip. All hour-label rendering and booking-block positioning must use the location timezone, not the browser timezone.
**Warning signs:** Booking blocks appear shifted by N hours compared to what was booked.

### Pitfall 4: Auto-Expire Running on Every Query
**What goes wrong:** Calling `autoExpireBookings()` before every booking query adds unnecessary UPDATE queries, increasing DB load and response latency.
**Why it happens:** Overzealous lazy expiration placement.
**How to avoid:** Call `autoExpireBookings()` only on targeted queries: `getMyBookings`, `getVehicleAvailability`, and `getAllBookings` (admin). These are the read paths where users expect fresh status. Do NOT call it on the availability search (browseAvailableVehicles) since that already filters by status.
**Warning signs:** Elevated DB write counts, slower API response times on read endpoints.

### Pitfall 5: Admin Cancel Without Reason Validation
**What goes wrong:** Admin cancels a booking but the cancelReason field is empty or whitespace-only. The employee sees "Cancelled by Admin" with no explanation.
**Why it happens:** Frontend form allows submission without validation, or backend doesn't enforce non-empty reason.
**How to avoid:** Validate cancelReason on both frontend (disable button when empty) and backend (Zod `.min(1).trim()` validation). The user decision explicitly requires a "required reason field."
**Warning signs:** Empty cancelReason values in the database.

### Pitfall 6: Suggestion Query Performance
**What goes wrong:** The suggestion query (finding nearby available slots + alternative vehicles) is slow, making the 409 conflict response take 2-5 seconds.
**Why it happens:** Running multiple sequential queries for each suggestion type without limiting the search range.
**How to avoid:** Bound the time-shift search to +/- 4 hours from the requested start time. Limit alt-vehicle search to same location, same status='Available'. Use a single query with UNION to fetch both types. Cap results at 3 total server-side.
**Warning signs:** Slow 409 responses, user perceives lag after conflict.

### Pitfall 7: Missing Overdue Status in Frontend Categorization
**What goes wrong:** MyBookings categorization logic (currently in `categorizeBookings`) doesn't handle the new 'Overdue' status, causing overdue bookings to fall into the "Past" fallback bucket.
**Why it happens:** Phase 3 categorization was based only on Confirmed/Active/Completed/Cancelled. Overdue is new.
**How to avoid:** Update the `categorizeBookings` function to treat 'Overdue' bookings as Active (they're still ongoing, just past due). Also update the IBooking status type to include 'Overdue'.
**Warning signs:** Overdue bookings appearing in Past tab instead of Active tab.

### Pitfall 8: ES5 Target Constraint
**What goes wrong:** Using arrow functions in `.map()`, `Array.from()`, template literals, `for...of`, or other ES6+ syntax in SPFx components causes build failures or runtime errors.
**Why it happens:** SPFx 1.22 Heft build targets ES5 for broad browser compatibility. Phase 3 already established the workaround pattern (named function expressions, string concatenation).
**How to avoid:** Follow the established Phase 3 patterns: use `function` expressions instead of arrows in array methods, use string concatenation instead of template literals, use indexed `for` loops instead of `for...of`.
**Warning signs:** Heft build errors about "unexpected token" or IE11 runtime failures in Teams desktop.

## Code Examples

### Check-Out Endpoint Pattern
```typescript
// api/src/services/bookingService.ts
async function checkOutBooking(
  bookingId: number,
  userId: string
): Promise<'checked_out' | 'not_found' | 'not_yours' | 'too_early' | 'expired' | 'wrong_status'> {
  const pool = await getPool();

  // First validate the booking
  const check = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query('SELECT id, userId, startTime, status FROM Bookings WHERE id = @bookingId');

  if (check.recordset.length === 0) return 'not_found';
  const booking = check.recordset[0];
  if (booking.userId !== userId) return 'not_yours';
  if (booking.status !== 'Confirmed') return 'wrong_status';

  const now = new Date();
  const startTime = new Date(booking.startTime);
  const thirtyMinBefore = new Date(startTime.getTime() - 30 * 60 * 1000);
  const oneHourAfter = new Date(startTime.getTime() + 60 * 60 * 1000);

  if (now < thirtyMinBefore) return 'too_early';
  if (now > oneHourAfter) return 'expired'; // Should have been auto-cancelled

  // Atomic status transition
  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query(`
      UPDATE Bookings
      SET status = 'Active', checkedOutAt = GETUTCDATE(), updatedAt = GETUTCDATE()
      WHERE id = @bookingId AND status = 'Confirmed'
    `);

  return result.rowsAffected[0] > 0 ? 'checked_out' : 'wrong_status';
}
```

### Calendar Timeline Data Query
```typescript
// api/src/services/bookingService.ts
interface ITimelineSlot {
  bookingId: number;
  vehicleId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  startTime: string;
  endTime: string;
  status: string;
  userId: string;
  userDisplayName: string | null;
}

async function getLocationTimeline(
  locationId: number,
  dayStart: Date,
  dayEnd: Date
): Promise<{ vehicles: IAvailableVehicle[]; bookings: ITimelineSlot[] }> {
  const pool = await getPool();

  // Get all non-archived vehicles at this location
  const vehiclesResult = await pool.request()
    .input('locationId', sql.Int, locationId)
    .query(`
      SELECT v.id, v.make, v.model, v.year, v.licensePlate,
             v.locationId, l.name AS locationName, l.timezone AS locationTimezone,
             v.categoryId, c.name AS categoryName, v.capacity, v.photoUrl, v.status
      FROM Vehicles v
      LEFT JOIN Categories c ON v.categoryId = c.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE v.isArchived = 0 AND v.status = 'Available' AND v.locationId = @locationId
      ORDER BY v.make, v.model
    `);

  // Get all bookings overlapping this day for vehicles at this location
  const bookingsResult = await pool.request()
    .input('locationId', sql.Int, locationId)
    .input('dayStart', sql.DateTime2, dayStart)
    .input('dayEnd', sql.DateTime2, dayEnd)
    .query(`
      SELECT b.id AS bookingId, b.vehicleId,
             v.make AS vehicleMake, v.model AS vehicleModel, v.licensePlate AS vehicleLicensePlate,
             b.startTime, b.endTime, b.status,
             b.userId, b.userDisplayName
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      WHERE v.locationId = @locationId
        AND v.isArchived = 0
        AND b.status IN ('Confirmed', 'Active', 'Overdue')
        AND b.startTime < @dayEnd
        AND b.endTime > @dayStart
      ORDER BY v.make, v.model, b.startTime
    `);

  return {
    vehicles: vehiclesResult.recordset,
    bookings: bookingsResult.recordset,
  };
}
```

### Suggestion Query Pattern
```typescript
// api/src/services/bookingService.ts
async function getBookingSuggestions(
  vehicleId: number,
  locationId: number,
  startTime: Date,
  endTime: Date,
  maxSuggestions: number = 3
): Promise<IBookingSuggestion[]> {
  const pool = await getPool();
  const duration = endTime.getTime() - startTime.getTime();
  const suggestions: IBookingSuggestion[] = [];

  // 1. Time shifts: check +1h, +2h, -1h, -2h for same vehicle
  const timeShifts = [1, -1, 2, -2, 3, -3, 4, -4]; // hours
  for (const shift of timeShifts) {
    if (suggestions.length >= 2) break; // Max 2 time shifts
    const shiftedStart = new Date(startTime.getTime() + shift * 3600000);
    const shiftedEnd = new Date(shiftedStart.getTime() + duration);

    const overlap = await pool.request()
      .input('vehicleId', sql.Int, vehicleId)
      .input('start', sql.DateTime2, shiftedStart)
      .input('end', sql.DateTime2, shiftedEnd)
      .query(`
        SELECT COUNT(*) AS cnt FROM Bookings
        WHERE vehicleId = @vehicleId
          AND status IN ('Confirmed', 'Active', 'Overdue')
          AND startTime < @end AND endTime > @start
      `);

    if (overlap.recordset[0].cnt === 0) {
      suggestions.push({
        type: 'time_shift',
        vehicleId,
        vehicleName: '', // filled by caller
        startTime: shiftedStart.toISOString(),
        endTime: shiftedEnd.toISOString(),
        label: (shift > 0 ? '+' : '') + shift + 'h from requested time',
      });
    }
  }

  // 2. Alt vehicles at same location for original time
  const altVehicles = await pool.request()
    .input('locationId', sql.Int, locationId)
    .input('vehicleId', sql.Int, vehicleId)
    .input('start', sql.DateTime2, startTime)
    .input('end', sql.DateTime2, endTime)
    .query(`
      SELECT TOP 3 v.id, v.make, v.model
      FROM Vehicles v
      WHERE v.locationId = @locationId
        AND v.id != @vehicleId
        AND v.isArchived = 0
        AND v.status = 'Available'
        AND NOT EXISTS (
          SELECT 1 FROM Bookings b
          WHERE b.vehicleId = v.id
            AND b.status IN ('Confirmed', 'Active', 'Overdue')
            AND b.startTime < @end AND b.endTime > @start
        )
    `);

  for (const alt of altVehicles.recordset) {
    if (suggestions.length >= maxSuggestions) break;
    suggestions.push({
      type: 'alt_vehicle',
      vehicleId: alt.id,
      vehicleName: alt.make + ' ' + alt.model,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      label: alt.make + ' ' + alt.model + ', same time',
    });
  }

  return suggestions.slice(0, maxSuggestions);
}
```

### Admin Cancel with Reason Pattern
```typescript
// api/src/services/bookingService.ts
async function adminCancelBooking(
  bookingId: number,
  adminUserId: string,
  cancelReason: string
): Promise<'cancelled' | 'not_found' | 'already_done'> {
  const pool = await getPool();

  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .input('adminUserId', sql.NVarChar(255), adminUserId)
    .input('cancelReason', sql.NVarChar(500), cancelReason)
    .query(`
      UPDATE Bookings
      SET status = 'Cancelled',
          cancelledAt = GETUTCDATE(),
          cancelledBy = @adminUserId,
          cancelReason = @cancelReason,
          updatedAt = GETUTCDATE()
      WHERE id = @bookingId
        AND status IN ('Confirmed', 'Active', 'Overdue')
    `);

  if (result.rowsAffected[0] === 0) {
    // Check if booking exists at all
    const check = await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query('SELECT id FROM Bookings WHERE id = @bookingId');
    return check.recordset.length === 0 ? 'not_found' : 'already_done';
  }

  return 'cancelled';
}
```

### BookingEntry with Check Out/Return Buttons
```typescript
// Extend existing BookingEntry.tsx pattern
// Add buttons conditionally based on booking status and current time

// Check Out button: visible when status === 'Confirmed' AND now >= startTime - 30min
// Return button: visible when status === 'Active' OR status === 'Overdue'
// Admin cancel reason: visible when status === 'Cancelled' AND cancelReason exists
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3: client-side Active detection via time comparison | Phase 4: explicit Active/Overdue status from check-out/check-in | Phase 4 | Frontend categorization can now rely on status column directly instead of time-based derivation |
| Phase 3: only Confirmed/Cancelled statuses used | Phase 4: full state machine (Confirmed/Active/Completed/Cancelled/Overdue) | Phase 4 | Update IBooking status type and all frontend categorization logic |
| Phase 3: simple 409 conflict with no alternatives | Phase 4: 409 response includes suggestion payload | Phase 4 | BookingForm must parse suggestion data from conflict response |

**Migration notes:**
- The `categorizeBookings` function in MyBookings.tsx currently derives Active status from time comparison. After Phase 4, Active is an explicit status from check-out. The categorization logic must be updated to handle both the explicit `Active` status and the new `Overdue` status.
- The `getMyBookings` backend query currently filters `status != 'Cancelled'`. This should be changed to return all statuses (including Cancelled with cancelReason) and let the frontend categorize. This aligns with the pending todo to show cancelled bookings.

## Pending Todos Relevant to Phase 4

Two pending todos from Phase 3 UAT are directly relevant:

1. **Add cancelled bookings history tab** (`MyBookings.tsx`): Phase 4 adds admin-cancelled bookings with cancelReason. This todo can be addressed within Phase 4 by showing cancelled bookings (including admin-cancelled ones with reason text) in the MyBookings component.

2. **Improve availability strip usability** (`AvailabilityStrip.tsx`, `BookingForm.tsx`): The new calendar timeline (BOOK-07) provides a much richer availability view. The AvailabilityStrip improvement can be deferred or simplified since the timeline is the primary availability visualization.

## API Endpoint Plan

### New Endpoints (Phase 4)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| PATCH | `/api/bookings/{id}/checkout` | Employee (owner only) | Check out -- Confirmed to Active |
| PATCH | `/api/bookings/{id}/return` | Employee (owner only) | Return -- Active/Overdue to Completed |
| GET | `/api/vehicles/timeline` | Employee | Calendar timeline data for a location + day |
| POST | `/api/bookings/suggestions` | Employee | Get suggestions for a conflicting booking |
| GET | `/api/backoffice/bookings` | Admin/SuperAdmin | All bookings with filters |
| DELETE | `/api/backoffice/bookings/{id}` | Admin/SuperAdmin | Admin cancel with reason |

### Modified Endpoints

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/bookings/my` | Include cancelled bookings (for admin cancel reason display) |
| POST | `/api/bookings` | On 409, include suggestion payload in response body |

### Conflict Response Enhancement

Current 409 response:
```json
{ "error": "This slot was just booked by someone else" }
```

Enhanced 409 response:
```json
{
  "error": "This slot was just booked by someone else",
  "suggestions": [
    { "type": "time_shift", "vehicleId": 5, "vehicleName": "...", "startTime": "...", "endTime": "...", "label": "+1h from requested time" },
    { "type": "alt_vehicle", "vehicleId": 8, "vehicleName": "Toyota Corolla", "startTime": "...", "endTime": "...", "label": "Toyota Corolla, same time" }
  ]
}
```

The frontend `postWithConflict` helper currently throws `Error('CONFLICT: ...')`. It must be updated to parse the JSON body and extract suggestions, passing them to the BookingForm for inline display.

## Open Questions

1. **Auto-cancel timing precision**
   - What we know: Lazy expiration runs on query access. The 1-hour window is checked when getMyBookings or similar runs.
   - What's unclear: If no user accesses the system for hours, expired bookings pile up and are all processed at once. Is this acceptable?
   - Recommendation: Acceptable for v1. The UPDATE query handles bulk expiration efficiently. If this becomes a concern, a Timer Trigger can be added later without changing the schema.

2. **Overdue booking admin actions**
   - What we know: User decided overdue bookings are visible to admin. Admin can cancel.
   - What's unclear: Can admin force-complete an overdue booking (e.g., vehicle was returned but employee forgot to check in)?
   - Recommendation: Include only cancel for now (per user decision "cancel only"). Force-complete can be a future enhancement.

3. **Calendar timeline day navigation**
   - What we know: Day view with hourly slots.
   - What's unclear: Should the timeline support navigating to past days (for reference) or only today and future?
   - Recommendation: Support today + future (with date picker). Past days add read-only value for admin debugging but can be deferred.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All existing files read directly from the repository (api/src/\*, spfx/src/\*)
- Fluent UI v8 components: DetailsList, Dialog, TextField, DatePicker, Dropdown are verified installed via `@fluentui/react: ^8.106.4` in package.json
- Azure SQL `mssql` library patterns: Verified from existing bookingService.ts, vehicleService.ts usage patterns
- SPFx 1.22 constraints: Verified from package.json, tsconfig, and established Phase 1-3 patterns (React 17.0.1, ES5 target)

### Secondary (MEDIUM confidence)
- CSS Grid for timeline: Standard browser API, well-supported. Verified compatible with SPFx 1.22 since the project already uses CSS Grid in AvailabilityStrip.
- Lazy expiration pattern: Common pattern in booking/reservation systems. Not library-specific -- pure SQL UPDATE with WHERE conditions.

### Tertiary (LOW confidence)
- None -- all patterns are derived from existing codebase patterns or standard SQL/CSS/React techniques.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies. All libraries already installed and verified working.
- Architecture: HIGH - All patterns extend existing codebase patterns from Phases 1-3. No new architectural concepts.
- Pitfalls: HIGH - Identified from direct codebase analysis (status constraint, timezone handling, ES5 target, race conditions).

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- no fast-moving dependencies)
