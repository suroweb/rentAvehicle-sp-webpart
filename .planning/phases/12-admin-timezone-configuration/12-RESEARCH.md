# Phase 12: Admin Timezone Configuration - Research

**Researched:** 2026-03-02
**Domain:** IANA timezone management, Intl API, Fluent UI inline editing, Azure Functions PATCH endpoint
**Confidence:** HIGH

## Summary

Phase 12 adds admin timezone configuration per location and ensures all booking time displays use the correct location timezone. The codebase is remarkably well-prepared: the DB column (`timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC'`) already exists, the frontend `useTimezone` hook is production-ready and already used across all booking views, and all booking/vehicle API queries already join `l.timezone AS locationTimezone`. The remaining work is narrow and well-defined.

Three work streams: (1) API -- add a PATCH endpoint for updating location timezone with Zod validation, add `l.timezone` to the locations query, (2) Frontend -- add timezone column + inline ComboBox editor to LocationList, add IANA timezone data module, add ApiService method, (3) Notifications -- replace hardcoded `timeZone: 'UTC'` in `adaptiveCards.ts` (3 places) and `emailConfirmation.ts` (1 place) with location timezone, and update `getRawBookingData` to include `locationTimezone` for export formatting.

**Primary recommendation:** Follow existing PATCH endpoint patterns (e.g., `PATCH backoffice/vehicles/{id}/status`). Use `Intl.supportedValuesOf('timeZone')` at build time to generate the static IANA list. Use Fluent UI v8 ComboBox with `allowFreeform={true}` and `autoComplete="on"` for the inline searchable timezone picker.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Searchable dropdown (Fluent UI ComboBox with autocomplete)
- Full IANA timezone database (~400 zones) -- locations are worldwide, no curated subset
- IANA list hardcoded in the frontend (zones rarely change, avoids extra API call)
- Options display with UTC offset prefix: "(UTC+02:00) Europe/Bucharest"
- Timezone column always visible in the LocationList table
- Inline edit in the table -- click timezone cell to activate searchable dropdown
- Auto-save on selection -- selecting a timezone immediately saves via API, show brief success indicator
- Both Admin and SuperAdmin roles can edit timezones
- No confirmation or warning when changing timezone (bookings are UTC-stored, display adjusts automatically)
- New locations synced from Entra ID default to UTC
- Unconfigured locations (still on UTC default) highlighted with visual indicator (e.g. "Not configured" styling) to nudge admins
- Visual indicator in the table is sufficient -- no filter/sort for unconfigured locations needed
- No migration script -- admins configure timezones manually through the new UI
- Email confirmations show booking times in the location's configured timezone (not UTC)
- Teams adaptive cards show booking times in the location's configured timezone
- Report exports show booking times in each booking's location timezone
- Timezone abbreviation (e.g. EET, CET) always shown next to times in notifications for clarity

### Claude's Discretion
- Timezone table column cell format (IANA name with or without abbreviation)
- Exact visual indicator style for unconfigured timezones
- Success indicator style after inline save
- Loading/error states for the inline edit

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FEAT-01 | Admin can view and edit timezone setting for each location | LocationList timezone column + inline ComboBox editor + PATCH API endpoint + Zod validation. Pattern matches existing `PATCH backoffice/vehicles/{id}/status`. |
| FEAT-02 | Location timezone is used for all booking time display at that location | Already 95% implemented via `useTimezone` hook + `locationTimezone` joins in all booking queries. Remaining: fix notification templates (3 hardcoded `timeZone: 'UTC'` in adaptiveCards.ts, 1 in emailConfirmation.ts), add timezone to raw export data, format report CSV times in location timezone. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fluentui/react` | ^8.106.4 | ComboBox component for searchable timezone picker | Already in project, v8 ComboBox supports `allowFreeform` + `autoComplete` |
| `zod` | ^3.0.0 | API request body validation for timezone PATCH | Already used for all API input validation (VehicleInputSchema, etc.) |
| `Intl.supportedValuesOf('timeZone')` | ES2022 built-in | Generate IANA timezone list | No external dependency needed; supported in all target runtimes |
| `Intl.DateTimeFormat` | ES5+ built-in | Timezone offset calculation + time formatting | Already used throughout codebase (`useTimezone` hook, notification templates) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mssql` | (existing) | SQL parameterized queries for UPDATE | Used for the timezone UPDATE query in locationService |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded IANA list | `moment-timezone` or `@internationalized/date` | Overkill -- `Intl.supportedValuesOf` provides the list natively; project already uses Intl for all timezone operations |
| ComboBox inline edit | Separate edit dialog/panel | User explicitly chose inline edit with auto-save |
| ComboBox | VirtualizedComboBox | ~400 items is within ComboBox performance limits; VirtualizedComboBox adds complexity for marginal benefit |

**Installation:**
```bash
# No new dependencies needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  functions/locations.ts        # Add PATCH handler (updateLocationTimezone)
  services/locationService.ts   # Add updateTimezone() + fix getLocationsWithVehicleCounts() to include timezone
  models/Location.ts            # Add TimezoneUpdateSchema (Zod)

spfx/src/webparts/rentaVehicle/
  data/timezones.ts             # New: Static IANA timezone list with UTC offsets
  components/LocationList/
    LocationList.tsx             # Add timezone column + inline ComboBox editor
    LocationList.module.scss     # Add timezone cell styles (unconfigured indicator, save states)
  services/ApiService.ts        # Add updateLocationTimezone() method
  models/ILocation.ts           # timezone field already exists (optional -> required in display)

api/src/templates/
  adaptiveCards.ts              # Accept timezone param, replace hardcoded UTC
  emailConfirmation.ts          # Accept timezone param, replace hardcoded UTC
api/src/services/
  notificationService.ts        # Pass locationTimezone through to templates
  reportingService.ts           # Add l.timezone to getRawBookingData query
```

### Pattern 1: PATCH Endpoint (follow existing vehicle status pattern)
**What:** Single-field PATCH endpoint with Zod validation
**When to use:** Updating a single property on a resource
**Example:**
```typescript
// api/src/functions/locations.ts -- follows PATCH backoffice/vehicles/{id}/status pattern
import { z } from 'zod';

// Zod schema validates IANA timezone string
const TimezoneUpdateSchema = z.object({
  timezone: z.string().min(1).max(64).refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch { return false; }
    },
    { message: 'Invalid IANA timezone identifier' }
  ),
});

// PATCH /api/backoffice/locations/{id}/timezone
async function updateLocationTimezone(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const user = await getUserFromRequest(request);
  if (!user) return { status: 401, jsonBody: { error: 'Not authenticated' } };
  if (!isAdminOrSuperAdmin(user)) return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) return { status: 400, jsonBody: { error: 'Invalid location ID' } };

  const body = await request.json();
  const parsed = TimezoneUpdateSchema.safeParse(body);
  if (!parsed.success) return { status: 400, jsonBody: { error: 'Validation failed', details: parsed.error.flatten() } };

  const updated = await updateTimezone(id, parsed.data.timezone);
  if (!updated) return { status: 404, jsonBody: { error: 'Location not found' } };

  return { jsonBody: { success: true } };
}
```
Source: Follows pattern from `api/src/functions/vehicles.ts` lines 296-342 (changeVehicleStatus)

### Pattern 2: Static IANA Timezone Data Module
**What:** Hardcoded timezone list generated using `Intl.supportedValuesOf('timeZone')`
**When to use:** Providing timezone options to the ComboBox
**Example:**
```typescript
// spfx/src/webparts/rentaVehicle/data/timezones.ts

/** Compute UTC offset string for an IANA timezone. */
function getUtcOffset(tz: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(new Date());
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  // Returns "GMT+2", "GMT-5", "GMT" etc.
  const offset = tzPart ? tzPart.value.replace('GMT', 'UTC') : 'UTC';
  return offset === 'UTC' ? 'UTC+00:00' : offset;
}

// NOTE: SPFx targets ES5, so Intl.supportedValuesOf may not be available at runtime.
// Solution: Generate the list at dev time and export as a static array, or use
// a hardcoded list derived from the IANA database. See "Don't Hand-Roll" section.

export interface ITimezoneOption {
  key: string;       // IANA identifier e.g. "Europe/Bucharest"
  text: string;      // Display text e.g. "(UTC+02:00) Europe/Bucharest"
  offset: string;    // For sorting e.g. "+02:00"
}

// Hardcoded list sorted by UTC offset, then alphabetically
export const TIMEZONE_OPTIONS: ITimezoneOption[] = [
  // Generated from Intl.supportedValuesOf('timeZone') -- see generation script
  // ...
];
```

### Pattern 3: Inline ComboBox Editor in DetailsList
**What:** Click-to-edit pattern using Fluent UI ComboBox inside a DetailsList column
**When to use:** Inline editing a cell value with a searchable dropdown
**Example:**
```typescript
// In LocationList.tsx onRender for timezone column
const [editingLocationId, setEditingLocationId] = React.useState<number | null>(null);

// Column onRender
onRender: (item: ILocation) => {
  if (editingLocationId === item.id) {
    return (
      <ComboBox
        autoComplete="on"
        allowFreeform={true}
        options={timezoneOptions}
        selectedKey={item.timezone || 'UTC'}
        onChange={(_ev, option) => {
          if (option) handleTimezoneChange(item.id, option.key as string);
        }}
        onBlur={() => setEditingLocationId(null)}
        openOnKeyboardFocus
        autofill={{ autoFillEnabled: true }}
        styles={{ root: { minWidth: 280 } }}
      />
    );
  }
  // Read-only display
  return (
    <span
      onClick={() => setEditingLocationId(item.id)}
      className={item.timezone === 'UTC' ? styles.timezoneUnconfigured : styles.timezoneCell}
      title="Click to edit timezone"
    >
      {item.timezone || 'UTC'}
    </span>
  );
}
```
Source: Fluent UI v8 ComboBox API -- `allowFreeform`, `autoComplete`, `onChange` (IComboBoxProps)

### Pattern 4: Notification Template Timezone Parameterization
**What:** Pass location timezone through the notification pipeline instead of hardcoding UTC
**When to use:** Whenever formatting booking times for external display (emails, Teams)
**Example:**
```typescript
// api/src/templates/adaptiveCards.ts
// BEFORE:
function formatShort(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { ..., timeZone: 'UTC' }).format(date);
}

// AFTER:
function formatShort(dateStr: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { ..., timeZone: timezone }).format(date);
}

// All 4 build* functions accept timezone parameter
export function buildBookingConfirmationPreview(
  vehicleName: string, startDate: string, endDate: string, timezone: string
): string { ... }
```

### Anti-Patterns to Avoid
- **Fetching timezone list from API:** User locked decision: hardcode in frontend. Zones rarely change; an API call adds latency for no benefit.
- **Using moment-timezone or luxon:** Project already uses native Intl API everywhere. Adding a timezone library would be inconsistent and add bundle size.
- **Storing timezone offset (e.g., +02:00) instead of IANA identifier:** Offsets change with DST. IANA names like `Europe/Bucharest` automatically handle DST transitions.
- **Converting stored UTC times on the backend:** Keep UTC as the single source of truth in the database. Timezone conversion should happen at display time only (frontend for UI, backend for notifications/emails).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IANA timezone validation | Regex or string matching | `Intl.DateTimeFormat(undefined, { timeZone: tz })` try/catch | Throws RangeError for invalid timezones; always current with runtime's ICU data |
| UTC offset calculation | Manual offset arithmetic | `Intl.DateTimeFormat` with `timeZoneName: 'shortOffset'` | Automatically handles DST transitions, historical changes |
| Timezone abbreviation extraction | Hardcoded abbreviation map | `useTimezone` hook (already exists) calls `extractTimezoneAbbr()` | Already working in production, handles all edge cases |
| Searchable dropdown | Custom autocomplete component | Fluent UI v8 `ComboBox` with `allowFreeform={true}` + `autoComplete="on"` | Battle-tested component already in the project's UI library |
| Time formatting in location timezone | Custom date math | `Intl.DateTimeFormat` with `timeZone` option | Already proven pattern in `useTimezone` hook and `localToUtcIso` function |

**Key insight:** The `Intl` API (built into all modern JS runtimes) handles timezone operations natively. The project already uses it extensively. No external timezone library is needed.

## Common Pitfalls

### Pitfall 1: SPFx ES5 Target and Intl.supportedValuesOf
**What goes wrong:** `Intl.supportedValuesOf('timeZone')` is ES2022 and may not be available in the SPFx runtime (which targets ES5 and runs in older webview environments in some SharePoint contexts).
**Why it happens:** SPFx webparts can run in IE11/Edge Legacy webviews in older SharePoint deployments. Even modern SharePoint uses an ES5 target.
**How to avoid:** Do NOT call `Intl.supportedValuesOf` at runtime in SPFx code. Instead, generate the static timezone list as a hardcoded TypeScript array. The generation can use a Node.js script or be done manually. The array is ~400 entries and is stable (IANA database changes are very rare and only add/rename zones, never remove).
**Warning signs:** Runtime error `Intl.supportedValuesOf is not a function` in the browser console.

### Pitfall 2: UTC Offsets Change with DST
**What goes wrong:** Displaying "(UTC+02:00) Europe/Bucharest" when it's actually UTC+03:00 during summer (EEST).
**Why it happens:** UTC offsets are computed at a specific point in time. The offset displayed in the dropdown may differ from the offset during the booking period.
**How to avoid:** Accept that the offset in the dropdown is "current offset" for visual sorting/grouping only. The IANA name is the authoritative value. Consider adding a note like "(current offset)" or just accept the convention that most timezone pickers show current offset.
**Warning signs:** User reports that the offset shown doesn't match what they expected for a future date.

### Pitfall 3: LocationService Query Missing timezone Column
**What goes wrong:** The `getLocationsWithVehicleCounts()` query in `locationService.ts` currently does NOT select `l.timezone`. The frontend LocationList won't have timezone data.
**Why it happens:** The timezone column was added to the schema later (Phase 3) but the locations admin query (Phase 2) was never updated to include it.
**How to avoid:** Add `l.timezone` to the SELECT and GROUP BY clauses in `getLocationsWithVehicleCounts()`.
**Warning signs:** `undefined` in the timezone column of LocationList.

### Pitfall 4: Notification Query Missing locationTimezone
**What goes wrong:** The notification service queries (`sendBookingNotifications`, `processPickupReminders`, `processReturnReminders`, `processOverdueNotifications`) do not currently select `l.timezone` from the Locations join.
**Why it happens:** These queries were written before timezone was a consideration. They join Locations only for `l.name`.
**How to avoid:** Add `l.timezone AS locationTimezone` to all 4 notification query SELECTs. Then pass the timezone through to the template functions.
**Warning signs:** Notifications still showing UTC times after the phase is "complete".

### Pitfall 5: Raw Export Data Has No Timezone Column
**What goes wrong:** The `getRawBookingData()` query and `IRawBookingRecord` interface don't include timezone information. CSV export shows raw UTC timestamps.
**Why it happens:** The export was designed before timezone awareness. The query joins Locations for `l.name` but not `l.timezone`.
**How to avoid:** Add `l.timezone AS locationTimezone` to the raw export query, add `locationTimezone` to `IRawBookingRecord`, and format times in the CSV using the location timezone (both API and frontend sides).
**Warning signs:** CSV export times don't match what users see in the UI.

### Pitfall 6: ComboBox with 400+ Items Performance
**What goes wrong:** Rendering 400+ ComboBox options can cause lag on first open.
**Why it happens:** The ComboBox renders all option DOM nodes when opened.
**How to avoid:** The `autoComplete="on"` setting with `allowFreeform={true}` makes this manageable because users type to filter. If performance is an issue, consider `VirtualizedComboBox` from `@fluentui/react/lib/VirtualizedComboBox`. But 400 items is generally fine for ComboBox.
**Warning signs:** Noticeable delay (>200ms) when opening the dropdown.

## Code Examples

Verified patterns from the existing codebase:

### IANA Timezone Validation (Backend, Zod)
```typescript
// Source: api/src/models/Vehicle.ts pattern + Intl API
import { z } from 'zod';

export const TimezoneUpdateSchema = z.object({
  timezone: z.string().min(1).max(64).refine(
    (tz: string): boolean => {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone identifier' }
  ),
});
```

### Location Timezone UPDATE Query (Backend, mssql)
```typescript
// Source: follows pattern from vehicleService.ts updateVehicleStatus
export async function updateTimezone(locationId: number, timezone: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, locationId)
    .input('timezone', sql.NVarChar(64), timezone)
    .query('UPDATE Locations SET timezone = @timezone, updatedAt = GETUTCDATE() WHERE id = @id');
  return result.rowsAffected[0] > 0;
}
```

### Fix getLocationsWithVehicleCounts to Include timezone
```typescript
// Source: api/src/services/locationService.ts -- current query is missing l.timezone
const result = await request.query(`
  SELECT
    l.id, l.name, l.isActive, l.timezone, l.lastSyncedAt, l.createdAt, l.updatedAt,
    COUNT(v.id) AS vehicleCount
  FROM Locations l
  LEFT JOIN Vehicles v ON l.id = v.locationId AND v.isArchived = 0
  GROUP BY l.id, l.name, l.isActive, l.timezone, l.lastSyncedAt, l.createdAt, l.updatedAt
  ORDER BY l.name
`);
```

### UTC Offset Calculation for Display
```typescript
// For generating the static timezone list
function getUtcOffsetLabel(tz: string): string {
  try {
    // Use a fixed date to get consistent offsets (January for standard time)
    const jan = new Date(2026, 0, 15, 12, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(jan);
    const tzPart = parts.find(function findTz(p) { return p.type === 'timeZoneName'; });
    if (!tzPart) return '(UTC+00:00)';
    // Converts "GMT+2" -> "(UTC+02:00)", "GMT-5" -> "(UTC-05:00)", "GMT" -> "(UTC+00:00)"
    const raw = tzPart.value.replace('GMT', '');
    if (!raw) return '(UTC+00:00)';
    const sign = raw.charAt(0);
    const parts2 = raw.substring(1).split(':');
    const hours = parts2[0].padStart(2, '0');
    const mins = parts2.length > 1 ? parts2[1] : '00';
    return '(UTC' + sign + hours + ':' + mins + ')';
  } catch {
    return '(UTC+00:00)';
  }
}
```

### Notification Template Fix
```typescript
// Source: api/src/templates/emailConfirmation.ts -- current formatDateTime hardcodes UTC
// BEFORE:
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'UTC',
  }).format(date);
}

// AFTER:
function formatDateTime(dateStr: string, timezone: string): string {
  const date = new Date(dateStr);
  // Get timezone abbreviation for clarity
  const abbrFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  const formatted = abbrFormatter.format(date);
  const commaIndex = formatted.lastIndexOf(', ');
  const abbr = commaIndex >= 0 ? formatted.substring(commaIndex + 2) : timezone;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: timezone,
  }).format(date) + ' ' + abbr;
}
```

### ApiService Method
```typescript
// Source: follows existing patch pattern from ApiService.ts line 72-74
public async updateLocationTimezone(locationId: number, timezone: string): Promise<void> {
  await this.patch<void>(
    '/api/backoffice/locations/' + String(locationId) + '/timezone',
    { timezone }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `moment-timezone` for timezone data + formatting | Native `Intl.DateTimeFormat` with IANA timezone support | ES2018+ / Browser support 2020+ | No dependencies needed; project already uses Intl throughout |
| Manual timezone offset tables | `Intl.supportedValuesOf('timeZone')` for timezone enumeration | ES2022 (Chrome 93+, Node 18+) | Runtime-generated complete list; however SPFx ES5 target requires static generation |
| Hardcoded abbreviated timezone lists | Full IANA database via Intl API | Ongoing | 400+ zones with automatic DST handling |

**Deprecated/outdated:**
- `moment-timezone`: Moment.js is in maintenance mode since 2020. Project correctly uses Intl API instead.
- Manual UTC offset storage: Storing offsets like "+02:00" doesn't handle DST. IANA identifiers (e.g., "Europe/Bucharest") are the correct approach and what this project uses.

## Open Questions

1. **Static timezone list generation approach**
   - What we know: `Intl.supportedValuesOf('timeZone')` returns ~400 IANA zones. SPFx ES5 target may not support this API at runtime.
   - What's unclear: Whether SPFx in modern SharePoint Online (2026) supports `Intl.supportedValuesOf` in its webview. The safe bet is a hardcoded array.
   - Recommendation: Generate the array once using a Node.js script (`node -e "console.log(JSON.stringify(Intl.supportedValuesOf('timeZone')))"`) and store as a static TypeScript file. This is the approach the user chose ("hardcoded in the frontend"). Include UTC offset labels computed for January (standard time) as the display format. The list can be regenerated periodically if needed but the IANA database changes very infrequently.

2. **ComboBox auto-open behavior in DetailsList cell**
   - What we know: Fluent UI ComboBox can be opened programmatically and supports `openOnKeyboardFocus`.
   - What's unclear: Whether clicking the cell to activate edit mode and auto-opening the ComboBox dropdown simultaneously works smoothly. May need a `componentRef` to call `.focus()` after state change.
   - Recommendation: Implement and test. If auto-open is janky, the user can click the cell (enters edit mode) then click the dropdown arrow or start typing. The `autoComplete="on"` behavior will still work.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `useTimezone` hook, `localToUtcIso`, all booking query joins with `l.timezone AS locationTimezone` -- verified by reading source files
- Existing codebase: `api/src/functions/vehicles.ts` PATCH pattern, `api/src/models/Vehicle.ts` Zod schema pattern -- verified by reading source files
- Existing codebase: `api/src/templates/adaptiveCards.ts` and `emailConfirmation.ts` with hardcoded `timeZone: 'UTC'` -- verified by reading source files
- Existing codebase: `api/src/services/locationService.ts` `getLocationsWithVehicleCounts()` missing `l.timezone` -- verified by reading source
- MDN: `Intl.supportedValuesOf()` -- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf

### Secondary (MEDIUM confidence)
- Fluent UI v8 ComboBox API: `allowFreeform`, `autoComplete`, `onChange` signature -- verified via GitHub issues and community documentation
- Node.js 18+ supports `Intl.supportedValuesOf` -- verified via Node.js official docs reference

### Tertiary (LOW confidence)
- SPFx ES5 target compatibility with `Intl.supportedValuesOf` -- not directly verified; mitigation is using hardcoded array (matches user's decision anyway)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; no new dependencies
- Architecture: HIGH - Follows existing patterns exactly (PATCH endpoint, Zod validation, Fluent UI DetailsList)
- Pitfalls: HIGH - All identified through direct codebase analysis of the exact files that need changes
- Notification integration: HIGH - All 4 hardcoded UTC references identified with exact file locations and line numbers

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain; IANA timezone database and Intl API are mature standards)
