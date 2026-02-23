# Phase 3: Core Booking Flow - Research

**Researched:** 2026-02-23
**Domain:** Vehicle booking system with timezone-aware availability, double-booking prevention, and employee self-service
**Confidence:** HIGH

## Summary

Phase 3 delivers the core product value: employees browsing available vehicles and booking them with hourly precision. The technical domain spans three areas: (1) a Bookings table in Azure SQL with database-level concurrency control to prevent double-bookings, (2) timezone-correct display of all date/times using the vehicle's location timezone regardless of the employee's browser timezone, and (3) a card-based vehicle search UI with inline filters, a vehicle detail page with availability strip, and a My Bookings tabbed view.

The existing codebase (Phases 1-2) provides all the scaffolding needed: Azure SQL via `mssql` with connection pooling, Zod validation, parameterized queries, role-based auth middleware, Fluent UI v8 components, `ApiService` with `AadHttpClient`, and `AppShell` with nav-key routing. The new work adds a `Bookings` table, booking-related API endpoints (under a new `/api/bookings` route prefix for employee-facing endpoints), timezone metadata on Locations, and three new SPFx pages (VehicleBrowse, VehicleDetail, MyBookings).

**Primary recommendation:** Store all times as UTC `DATETIME2` in Azure SQL. Add an IANA `timezone` column to the `Locations` table. Prevent double-bookings using `SERIALIZABLE` isolation level transactions with a check-then-insert pattern. Handle IANA-to-display conversion in the browser using native `Intl.DateTimeFormat`. Use Fluent UI v8 `DatePicker` + a custom hour `Dropdown` for time selection (no external date-time picker dependency needed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card grid layout, 2-3 cards per row on desktop, 1 on mobile
- Each card shows: vehicle photo, make/model/year, category badge, capacity, license plate, availability indicator
- Inline filters above results (always visible): location, date/time range, category
- Employee's location auto-detected from Entra ID profile and pre-selected as default filter
- Employee can change location filter to browse other sites
- Date picker for start/end dates + hour dropdown (8:00, 9:00, etc.) for time selection
- Subtle timezone label near time fields showing vehicle location timezone (e.g., "(EET)" or "(Europe/Bucharest)")
- All displayed times are in the vehicle's location timezone regardless of employee's browser timezone
- Review step before confirming: summary shows vehicle, dates/times, location, timezone with "Confirm Booking" button
- On booking conflict (race condition): error message "This slot was just booked by someone else" + refresh availability view
- Three tabs for My Bookings: Upcoming, Active, Past
- Each booking entry shows: vehicle photo thumbnail, make/model, license plate, category, start/end datetime, location name
- Upcoming bookings have a cancel button with confirmation dialog ("Are you sure?")
- Empty state: friendly message "No bookings yet" with "Book a Vehicle" action button navigating to search
- Full vehicle detail page with back navigation to search results
- Large hero image at top (full-width vehicle photo)
- Below photo: all specs (make, model, year, plate, category, capacity, location)
- Mini availability strip showing booked vs free times for the next 7 days
- Inline booking form (date/time pickers + "Book" button) on the same page below specs

### Claude's Discretion
- Loading skeleton designs
- Exact spacing, typography, and card styling
- Error state handling and retry patterns
- Availability strip visual design and interaction details
- Animation/transition between search results and detail page

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOOK-01 | Employee can browse available vehicles filtered by location, date/time range, and category | Availability query pattern using NOT EXISTS subquery against Bookings table; vehicle card grid with inline Fluent UI filters |
| BOOK-02 | Employee can view vehicle details (make, model, year, plate, category, capacity, photo) | Vehicle detail page reuses existing `getVehicleById` service; adds availability strip via 7-day booking query |
| BOOK-03 | Employee can book a vehicle with start date/time and return date/time (hourly precision) | Booking creation API with Zod validation; SERIALIZABLE transaction for atomicity; UTC storage with hourly precision |
| BOOK-04 | System prevents double-booking via database-level constraints | SERIALIZABLE isolation level transaction with check-then-insert pattern; 409 Conflict response on overlap |
| BOOK-05 | Employee can view their bookings (upcoming, active, past) | My Bookings API endpoint filtered by userId with status categorization based on current UTC time |
| BOOK-06 | All times displayed in user's local timezone (stored as UTC) | IANA timezone on Locations table; browser-side conversion via `Intl.DateTimeFormat`; REQUIREMENTS.md says "user's local timezone" but CONTEXT.md overrides to "vehicle's location timezone" -- follow CONTEXT.md |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mssql | ^12.2.0 | Azure SQL client with transaction support | Already used in Phase 2; supports SERIALIZABLE isolation |
| zod | ^3.0.0 | Input validation for booking payloads | Already used for Vehicle/Category schemas |
| @fluentui/react | ^8.106.4 | UI components (DatePicker, Dropdown, Pivot, etc.) | SPFx 1.22 standard; v9 not compatible |
| React | 17.0.1 | UI framework | SPFx 1.22 pin; React 18 breaks SPFx |
| @azure/functions | ^4.11.2 | Azure Functions HTTP triggers | Already used for all API endpoints |

### Supporting (new for Phase 3)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | - |

**No new npm dependencies required.** The browser's native `Intl.DateTimeFormat` API handles IANA timezone conversion (supported in all modern browsers, including Edge/Chrome used by SPFx/Teams). Fluent UI v8 `DatePicker` + `Dropdown` handles date+hour selection. The `mssql` package already supports transactions with isolation levels.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `Intl.DateTimeFormat` | date-fns-tz or Luxon | Adds bundle size (17KB+ for date-fns); native API is sufficient for formatting UTC dates in IANA zones |
| Fluent UI DatePicker + Dropdown | @pnp/spfx-controls-react DateTimePicker | Adds dependency with unverified SPFx 1.22 Heft compatibility; DatePicker+Dropdown is simpler and already available |
| SERIALIZABLE transaction | Unique constraint + retry | Unique constraints can't prevent range overlaps; SERIALIZABLE is the correct tool for range-based concurrency |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist in both api/ and spfx/ package.json
```

## Architecture Patterns

### Recommended Project Structure (new files)
```
api/src/
├── models/
│   └── Booking.ts              # Zod schemas + IBooking interface
├── services/
│   └── bookingService.ts       # Booking CRUD with transaction-based double-booking prevention
├── functions/
│   └── bookings.ts             # Employee-facing booking endpoints (NOT under /backoffice)
└── sql/
    └── schema.sql              # Updated: Bookings table + Locations.timezone column

spfx/src/webparts/rentaVehicle/
├── models/
│   └── IBooking.ts             # Frontend booking interface
├── components/
│   ├── VehicleBrowse/
│   │   ├── VehicleBrowse.tsx   # Card grid with filters
│   │   └── VehicleCard.tsx     # Individual vehicle card
│   ├── VehicleDetail/
│   │   ├── VehicleDetail.tsx   # Full detail page with booking form
│   │   └── AvailabilityStrip.tsx  # 7-day availability visualization
│   └── MyBookings/
│       └── MyBookings.tsx      # Tabbed booking list (Upcoming/Active/Past)
├── hooks/
│   └── useTimezone.ts          # Timezone formatting utility hook
└── services/
    └── ApiService.ts           # Extended with booking methods
```

### Pattern 1: SERIALIZABLE Transaction for Double-Booking Prevention
**What:** Use SQL Server SERIALIZABLE isolation level to atomically check for overlapping bookings and insert if none exist.
**When to use:** Every booking creation request.
**Why:** SERIALIZABLE acquires range locks that prevent other transactions from inserting rows with key values in the range being read. This means if Transaction A reads "no bookings overlap" and Transaction B tries to read the same range concurrently, Transaction B will block until Transaction A commits or rolls back.
**Example:**
```typescript
// Source: mssql npm docs + SQL Server isolation level docs
import sql from 'mssql';
import { getPool } from './database.js';

export async function createBooking(
  vehicleId: number,
  userId: string,
  startTime: Date,  // UTC
  endTime: Date,    // UTC
  userEmail: string
): Promise<{ id: number } | { conflict: true }> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    // SERIALIZABLE prevents phantom reads -- range locks block concurrent inserts
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction);
    request.input('vehicleId', sql.Int, vehicleId);
    request.input('startTime', sql.DateTime2, startTime);
    request.input('endTime', sql.DateTime2, endTime);

    // Check for overlapping bookings (range-locked by SERIALIZABLE)
    const overlapCheck = await request.query(`
      SELECT COUNT(*) AS overlapCount
      FROM Bookings
      WHERE vehicleId = @vehicleId
        AND status IN ('Confirmed', 'Active')
        AND startTime < @endTime
        AND endTime > @startTime
    `);

    if (overlapCheck.recordset[0].overlapCount > 0) {
      await transaction.rollback();
      return { conflict: true };
    }

    // No overlap -- insert the booking
    const insertRequest = new sql.Request(transaction);
    insertRequest.input('vehicleId', sql.Int, vehicleId);
    insertRequest.input('userId', sql.NVarChar(255), userId);
    insertRequest.input('userEmail', sql.NVarChar(255), userEmail);
    insertRequest.input('startTime', sql.DateTime2, startTime);
    insertRequest.input('endTime', sql.DateTime2, endTime);

    const result = await insertRequest.query(`
      INSERT INTO Bookings (vehicleId, userId, userEmail, startTime, endTime, status)
      OUTPUT INSERTED.id
      VALUES (@vehicleId, @userId, @userEmail, @startTime, @endTime, 'Confirmed')
    `);

    await transaction.commit();
    return { id: result.recordset[0].id };
  } catch (error) {
    try { await transaction.rollback(); } catch { /* already rolled back */ }
    throw error;
  }
}
```

### Pattern 2: Availability Query with NOT EXISTS
**What:** Filter available vehicles by excluding those with overlapping confirmed bookings.
**When to use:** Vehicle browse/search with date/time filters.
**Example:**
```sql
-- Find vehicles available at location X during the requested time slot
SELECT v.id, v.make, v.model, v.year, v.licensePlate,
       v.locationId, l.name AS locationName, l.timezone,
       v.categoryId, c.name AS categoryName,
       v.capacity, v.photoUrl, v.status
FROM Vehicles v
LEFT JOIN Categories c ON v.categoryId = c.id
LEFT JOIN Locations l ON v.locationId = l.id
WHERE v.isArchived = 0
  AND v.status = 'Available'
  AND v.locationId = @locationId
  AND (@categoryId IS NULL OR v.categoryId = @categoryId)
  AND NOT EXISTS (
    SELECT 1 FROM Bookings b
    WHERE b.vehicleId = v.id
      AND b.status IN ('Confirmed', 'Active')
      AND b.startTime < @endTime
      AND b.endTime > @startTime
  )
ORDER BY v.make, v.model
```

### Pattern 3: Timezone Display via Intl.DateTimeFormat
**What:** Convert UTC dates to vehicle's location timezone for display using the browser's native Intl API.
**When to use:** Every date/time display in the booking UI.
**Example:**
```typescript
// Source: MDN Intl.DateTimeFormat docs
/**
 * Format a UTC date string in a specific IANA timezone.
 * @param utcDateString - ISO string or Date from API (UTC)
 * @param ianaTimezone - IANA timezone e.g. "Europe/Bucharest"
 * @returns formatted local time string
 */
export function formatInTimezone(
  utcDateString: string | Date,
  ianaTimezone: string
): string {
  const date = typeof utcDateString === 'string'
    ? new Date(utcDateString)
    : utcDateString;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Get the short timezone abbreviation for display (e.g., "EET", "CET").
 */
export function getTimezoneAbbreviation(ianaTimezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    timeZoneName: 'short',
  }).formatToParts(new Date());

  return parts.find(p => p.type === 'timeZoneName')?.value ?? ianaTimezone;
}
```

### Pattern 4: Employee-Facing API Route Separation
**What:** Booking endpoints use `/api/bookings` prefix (not `/api/backoffice/bookings`) since employees (not just admins) access them.
**When to use:** All Phase 3 endpoints.
**Why:** Existing `/api/backoffice/*` routes require Admin/SuperAdmin. Employee booking endpoints need `Employee` minimum role.
**Route structure:**
```
GET    /api/vehicles/available    - Browse available vehicles (Employee+)
GET    /api/vehicles/{id}         - Get vehicle detail (Employee+)
GET    /api/vehicles/{id}/availability  - 7-day availability slots (Employee+)
POST   /api/bookings              - Create booking (Employee+)
GET    /api/bookings/my           - My bookings (Employee+)
DELETE /api/bookings/{id}         - Cancel own booking (Employee+)
```

### Pattern 5: Booking Status Lifecycle
**What:** Bookings progress through defined statuses.
**Statuses:** `Confirmed` -> `Active` -> `Completed` | `Cancelled`
- **Confirmed**: Future booking, slot is reserved
- **Active**: Current time is within booking window (Phase 4 adds explicit check-out)
- **Completed**: Booking end time has passed
- **Cancelled**: Employee cancelled before start time
**For Phase 3:** Confirmed and Cancelled are the actionable states. Active/Completed are derived from current time vs start/end for display grouping in My Bookings.

### Anti-Patterns to Avoid
- **Application-level locking for double-booking prevention:** Never use in-memory locks, Redis locks, or optimistic concurrency for range-based overlap checks. Database SERIALIZABLE isolation is the correct tool.
- **Storing times in local timezone:** Always store UTC in the database. Convert to local timezone only at the display layer.
- **Client-side timezone conversion with offsets:** Don't hardcode UTC offsets. Use IANA timezone names with `Intl.DateTimeFormat` which automatically handles DST transitions.
- **Querying bookings without status filter:** Always filter by `status IN ('Confirmed', 'Active')` when checking availability. Cancelled/Completed bookings must not block new reservations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone display conversion | Manual UTC offset calculation | `Intl.DateTimeFormat` with `timeZone` option | Handles DST automatically; no bundle cost; browser-native |
| Timezone abbreviation | Hardcoded timezone label map | `Intl.DateTimeFormat.formatToParts()` with `timeZoneName: 'short'` | Abbreviations change with DST (EET/EEST); Intl handles this |
| Date overlap detection | Custom interval comparison code | SQL `WHERE startTime < @endTime AND endTime > @startTime` | Standard half-open interval overlap formula; well-tested |
| Concurrent booking prevention | Application-level mutex/lock | SQL Server `SERIALIZABLE` isolation level | Database handles the locking; works across multiple API instances |
| Date picker + time picker combo | Custom date-time input component | Fluent UI `DatePicker` + `Dropdown` side by side | Already available; consistent with Fluent UI design system |

**Key insight:** The most dangerous hand-rolling in this phase would be building custom double-booking prevention logic at the application layer. Under concurrent load, any check-then-insert without database-level range locking will eventually allow a double booking. SERIALIZABLE is the industry-standard solution.

## Common Pitfalls

### Pitfall 1: Timezone Storage Strategy
**What goes wrong:** Storing dates in local timezone or storing the UTC offset instead of the IANA timezone name. When DST changes, offsets shift and stored offsets become wrong.
**Why it happens:** Developers think "UTC+2" is simpler than "Europe/Bucharest".
**How to avoid:** Store IANA timezone name (e.g., "Europe/Bucharest") on the Locations table. Store all booking times as UTC `DATETIME2`. Convert to local only at display time.
**Warning signs:** Hardcoded offset values anywhere in the codebase; timezone abbreviations that don't change with seasons.

### Pitfall 2: Half-Open Interval Overlap Check
**What goes wrong:** Using `<=` and `>=` instead of `<` and `>` for overlap detection, causing adjacent bookings to appear as conflicts (e.g., booking ending at 14:00 conflicts with booking starting at 14:00).
**Why it happens:** Intuitive but incorrect boundary logic.
**How to avoid:** Use half-open intervals: `startTime < @endTime AND endTime > @startTime`. A booking from 13:00-14:00 does NOT overlap with 14:00-15:00.
**Warning signs:** Users can't book back-to-back time slots.

### Pitfall 3: SERIALIZABLE Deadlock Handling
**What goes wrong:** SERIALIZABLE transactions can deadlock when two concurrent transactions acquire range locks in different orders.
**Why it happens:** SQL Server detects the deadlock and kills one transaction, throwing error 1205.
**How to avoid:** Catch deadlock errors (SQL Server error number 1205) and return 409 Conflict to the client. The client shows "This slot was just booked by someone else" per the locked decision. Do NOT retry automatically -- let the user see refreshed availability and try again.
**Warning signs:** Unhandled errors in booking creation; generic 500 errors instead of 409.

### Pitfall 4: Booking Status Determination Timing
**What goes wrong:** Storing "Active" and "Completed" as explicit status updates requires background jobs or triggers to transition bookings at the right time.
**Why it happens:** Developers try to keep the database as the single source of truth for current status.
**How to avoid:** For Phase 3, determine "Upcoming/Active/Past" at query time based on current UTC time vs booking startTime/endTime. Only "Confirmed" and "Cancelled" are persisted statuses. The API response adds a computed `displayStatus` field.
**Warning signs:** A timer-based Azure Function to update booking statuses; stale status values.

### Pitfall 5: Employee Location Auto-Detection
**What goes wrong:** The `/api/me` endpoint doesn't currently return `officeLocation`. The SPFx side needs the employee's office location to pre-select the location filter.
**Why it happens:** Phase 1's `/api/me` only returns `userId`, `displayName`, `email`, `role`.
**How to avoid:** Extend the `/api/me` endpoint to include `officeLocation` from the Entra ID claims (the `officeLocation` claim is already available in `UserContext` from auth middleware). On the SPFx side, resolve the location name to a location ID using the Locations API.
**Warning signs:** Location filter always defaults to "all locations" instead of the employee's office.

### Pitfall 6: SPFx React 17 Compatibility
**What goes wrong:** Using React 18 hooks, features, or libraries that depend on React 18 (e.g., `useSyncExternalStore`, `useId`).
**Why it happens:** SPFx 1.22 pins React 17.0.1.
**How to avoid:** Only use React 17 compatible patterns. Test that all new components render in the SPFx local workbench.
**Warning signs:** Build errors about missing React exports; runtime errors about `__SECRET_INTERNALS`.

## Code Examples

### Bookings Table Schema
```sql
-- Source: Azure SQL DATETIME2 + foreign key patterns from existing schema.sql
-- Add timezone column to Locations
ALTER TABLE Locations ADD timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC';

-- Bookings table
CREATE TABLE Bookings (
  id INT IDENTITY(1,1) PRIMARY KEY,
  vehicleId INT NOT NULL REFERENCES Vehicles(id),
  userId NVARCHAR(255) NOT NULL,          -- Entra ID user OID
  userEmail NVARCHAR(255) NOT NULL,       -- For display and audit
  userDisplayName NVARCHAR(255) NULL,     -- For display
  startTime DATETIME2 NOT NULL,           -- UTC
  endTime DATETIME2 NOT NULL,             -- UTC
  status NVARCHAR(20) NOT NULL DEFAULT 'Confirmed'
    CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled')),
  cancelledAt DATETIME2 NULL,
  cancelledBy NVARCHAR(255) NULL,
  createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT CK_Bookings_TimeOrder CHECK (endTime > startTime)
);

-- Indexes for availability queries and user lookups
CREATE INDEX IX_Bookings_VehicleId_Status ON Bookings(vehicleId, status)
  INCLUDE (startTime, endTime);
CREATE INDEX IX_Bookings_UserId ON Bookings(userId)
  INCLUDE (status, startTime, endTime);
CREATE INDEX IX_Bookings_StartTime ON Bookings(startTime)
  WHERE status IN ('Confirmed', 'Active');
```

### Booking Input Validation (Zod)
```typescript
// Source: Existing Zod pattern from models/Vehicle.ts
import { z } from 'zod';

export const BookingInputSchema = z.object({
  vehicleId: z.number().int().positive(),
  startTime: z.string().datetime(),  // ISO 8601 UTC string
  endTime: z.string().datetime(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time' }
).refine(
  (data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return start.getMinutes() === 0 && end.getMinutes() === 0;
  },
  { message: 'Times must be on the hour (hourly precision)' }
);

export type BookingInput = z.infer<typeof BookingInputSchema>;

export interface IBooking {
  id: number;
  vehicleId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  vehicleCategoryName: string;
  vehiclePhotoUrl: string | null;
  locationName: string;
  locationTimezone: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  startTime: string;   // ISO UTC
  endTime: string;     // ISO UTC
  status: 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
  createdAt: string;
  cancelledAt: string | null;
}
```

### Vehicle Browse API (Employee-Facing)
```typescript
// Source: Pattern follows existing vehicles.ts function registration
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest } from '../middleware/auth.js';

async function browseAvailableVehicles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const user = getUserFromRequest(request);
  if (!user) {
    return { status: 401, jsonBody: { error: 'Not authenticated' } };
  }

  // All authenticated users can browse (Employee minimum)
  const locationId = request.query.get('locationId');
  const categoryId = request.query.get('categoryId');
  const startTime = request.query.get('startTime');   // ISO UTC
  const endTime = request.query.get('endTime');        // ISO UTC

  // ... query available vehicles using NOT EXISTS pattern
}

app.http('browseAvailableVehicles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicles/available',
  handler: browseAvailableVehicles,
});
```

### Timezone-Aware Date Display Hook
```typescript
// Source: MDN Intl.DateTimeFormat documentation
import * as React from 'react';

interface ITimezoneFormatters {
  formatDateTime: (utcDate: string | Date) => string;
  formatDateOnly: (utcDate: string | Date) => string;
  formatTimeOnly: (utcDate: string | Date) => string;
  timezoneAbbr: string;
  ianaTimezone: string;
}

export function useTimezone(ianaTimezone: string): ITimezoneFormatters {
  return React.useMemo(() => {
    const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: ianaTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Get timezone abbreviation (e.g., "EET")
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const timezoneAbbr = parts.find(p => p.type === 'timeZoneName')?.value ?? ianaTimezone;

    const toDate = (d: string | Date): Date =>
      typeof d === 'string' ? new Date(d) : d;

    return {
      formatDateTime: (utcDate) => dateTimeFormatter.format(toDate(utcDate)),
      formatDateOnly: (utcDate) => dateFormatter.format(toDate(utcDate)),
      formatTimeOnly: (utcDate) => timeFormatter.format(toDate(utcDate)),
      timezoneAbbr,
      ianaTimezone,
    };
  }, [ianaTimezone]);
}
```

### Client-Side Time-to-UTC Conversion for Booking Submission
```typescript
/**
 * Convert a locally-selected date + hour (in vehicle's timezone) to UTC ISO string.
 *
 * The user selects "March 15, 2026 at 10:00" meaning 10:00 in the vehicle's timezone.
 * We need to send the corresponding UTC time to the API.
 *
 * Strategy: Construct a date string in the target timezone, then let the browser
 * convert it to UTC.
 */
export function localDateHourToUtc(
  date: Date,        // The selected date (year/month/day only)
  hour: number,      // The selected hour (0-23)
  ianaTimezone: string
): string {
  // Build an ISO-like string in the target timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');

  // Create a formatter that outputs in the target timezone
  // Then use it to find the UTC offset for that specific date/hour
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  });

  // Construct a Date in UTC, then adjust
  // Simpler approach: use the timezone offset
  const targetStr = `${year}-${month}-${day}T${hourStr}:00:00`;

  // Get the offset for this datetime in the target timezone
  // by formatting a known UTC date and comparing
  const tempDate = new Date(targetStr + 'Z'); // treat as UTC initially
  const inTz = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour: 'numeric', hour12: false,
  }).format(tempDate);
  const tzHour = parseInt(inTz, 10);
  const utcHour = tempDate.getUTCHours();
  const offsetHours = tzHour - utcHour;

  // Adjust: subtract the offset to get UTC
  const utcDate = new Date(targetStr + 'Z');
  utcDate.setUTCHours(utcDate.getUTCHours() - offsetHours);

  return utcDate.toISOString();
}
```

**Note on the above:** The local-to-UTC conversion is the trickiest part of timezone handling. An alternative simpler approach is to use a well-known technique: construct the date string with the IANA timezone and use a `Date` constructor that respects it. However, JavaScript's `Date` constructor does not accept IANA timezone names. The recommended approach for robustness is:

```typescript
/**
 * Simpler approach using Intl for accurate local-to-UTC conversion.
 * Formats a reference date in the target timezone, parses the offset,
 * and adjusts accordingly.
 */
export function localToUtcIso(
  year: number, month: number, day: number,
  hour: number, ianaTimezone: string
): string {
  // Step 1: Get the UTC offset for this date/time in the target timezone
  // by creating a date and reading its formatted offset
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    timeZoneName: 'longOffset',
  }).formatToParts(guess);

  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
  // offsetStr is like "GMT+02:00" or "GMT-05:00" or "GMT"
  const match = offsetStr.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = match
    ? (match[1] === '+' ? 1 : -1) * (parseInt(match[2]) * 60 + parseInt(match[3]))
    : 0;

  // Step 2: The user means hour:00 in local timezone
  // UTC = local - offset
  const utc = new Date(Date.UTC(year, month - 1, day, hour - Math.floor(offsetMinutes / 60), -(offsetMinutes % 60), 0));
  return utc.toISOString();
}
```

### Fluent UI Card Grid Pattern
```typescript
// Source: Fluent UI v8 patterns from existing FleetManagement
import * as React from 'react';
import { mergeStyles } from '@fluentui/react/lib/Styling';

const gridStyles = mergeStyles({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '16px',
  padding: '16px 0',
  '@media (max-width: 480px)': {
    gridTemplateColumns: '1fr',
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| moment.js + moment-timezone | Native `Intl.DateTimeFormat` | 2020+ (moment deprecated) | Zero bundle size for timezone formatting |
| Application-level locking (Redis/in-memory) | Database SERIALIZABLE isolation | Always been best practice | Prevents race conditions across multiple API instances |
| Storing local times + offset | Store UTC + IANA timezone name | Industry consensus 2015+ | Handles DST transitions correctly |
| Custom time picker components | Fluent UI DatePicker + Dropdown combo | SPFx 1.22 with Fluent UI v8 | Consistent with platform design system |

**Deprecated/outdated:**
- moment.js: Deprecated since 2020. Do not add to project.
- @pnp/spfx-controls-react DateTimePicker: Not verified with SPFx 1.22 Heft build. Avoid adding unverified dependencies.

## Open Questions

1. **Locations Table Timezone Population**
   - What we know: The `Locations` table currently has no `timezone` column. We need to add one. IANA timezone names (e.g., "Europe/Bucharest") are the correct format.
   - What's unclear: How to populate timezone data for existing locations. The Graph API `officeLocation` field is just a string (e.g., "Bucharest") -- it doesn't include timezone info. The Entra ID user endpoint does not reliably expose timezone per office.
   - Recommendation: Add the `timezone` column with a default of `'UTC'`. Provide an admin UI (or manual SQL script) to set the IANA timezone for each location during initial setup. This is a one-time configuration per location. Future enhancement: auto-detect timezone from location name using a mapping table or geolocation API.

2. **Hourly Precision Enforcement**
   - What we know: The user decision specifies hour dropdowns (8:00, 9:00, etc.). Bookings are hourly precision.
   - What's unclear: Whether the hour range should be constrained (e.g., 7:00-22:00) or allow 24-hour booking (0:00-23:00).
   - Recommendation: Default to full 24-hour range (0:00-23:00) in the hour dropdown. This can be restricted later if business rules require it. Validation ensures `endTime > startTime`.

3. **Vehicle Detail Access Control**
   - What we know: Current `getVehicleById` is under `/api/backoffice/vehicles/{id}` requiring Admin role.
   - What's unclear: Need a separate employee-facing endpoint or reuse existing one.
   - Recommendation: Create new employee-facing endpoints under `/api/vehicles/` that only return available (non-archived, status='Available') vehicles. Keep backoffice endpoints unchanged for admin use.

## Sources

### Primary (HIGH confidence)
- Azure SQL `AT TIME ZONE` documentation: https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql
- SQL Server transaction isolation levels: https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql
- MDN `Intl.DateTimeFormat`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- mssql npm package (transaction API): https://tediousjs.github.io/node-mssql/
- Fluent UI v8 DatePicker: https://github.com/microsoft/fluentui (v8 package)

### Secondary (MEDIUM confidence)
- PnP DateTimePicker docs: https://pnp.github.io/sp-dev-fx-controls-react/controls/DateTimePicker/
- windows-iana npm package: https://www.npmjs.com/package/windows-iana
- SQL Server range overlap prevention patterns: https://sqlfordevs.com/non-overlapping-time-ranges

### Tertiary (LOW confidence)
- SPFx 1.22 + date-fns compatibility: Not directly verified; based on general webpack/Heft compatibility patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; no new dependencies needed
- Architecture: HIGH - Transaction-based double-booking prevention is well-documented; timezone patterns use browser-native APIs
- Pitfalls: HIGH - Timezone and concurrency pitfalls are well-known in the industry; specific to this stack's patterns
- UI patterns: HIGH - Fluent UI v8 DatePicker/Dropdown are the existing project's component library; card grid is standard CSS grid

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain -- SQL transactions, Intl API, Fluent UI v8 are mature)
