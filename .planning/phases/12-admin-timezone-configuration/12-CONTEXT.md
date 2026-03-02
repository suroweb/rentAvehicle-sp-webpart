# Phase 12: Admin Timezone Configuration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can manage timezone settings per location, and all booking times display in the correct local timezone. This includes:
- Admin UI to view and edit timezone per location
- API endpoint to update location timezone
- All time displays (frontend, emails, Teams notifications, reports) use the location's configured timezone

Out of scope: auto-detection of timezones, bulk import/migration tools, user-level timezone preferences.

</domain>

<decisions>
## Implementation Decisions

### Timezone Picker UI
- Searchable dropdown (Fluent UI ComboBox with autocomplete)
- Full IANA timezone database (~400 zones) — locations are worldwide, no curated subset
- IANA list hardcoded in the frontend (zones rarely change, avoids extra API call)
- Options display with UTC offset prefix: "(UTC+02:00) Europe/Bucharest"
- Timezone column always visible in the LocationList table
- Claude's Discretion: table cell format (whether to include abbreviation alongside IANA name)

### Editing Experience
- Inline edit in the table — click timezone cell to activate searchable dropdown
- Auto-save on selection — selecting a timezone immediately saves via API, show brief success indicator
- Both Admin and SuperAdmin roles can edit timezones
- No confirmation or warning when changing timezone (bookings are UTC-stored, display adjusts automatically)

### Default & Migration Behavior
- New locations synced from Entra ID default to UTC
- Unconfigured locations (still on UTC default) highlighted with visual indicator (e.g. "Not configured" styling) to nudge admins
- Visual indicator in the table is sufficient — no filter/sort for unconfigured locations needed
- No migration script — admins configure timezones manually through the new UI

### Notifications & Emails
- Email confirmations show booking times in the location's configured timezone (not UTC)
- Teams adaptive cards show booking times in the location's configured timezone
- Report exports show booking times in each booking's location timezone
- Timezone abbreviation (e.g. EET, CET) always shown next to times in notifications for clarity

### Claude's Discretion
- Timezone table column cell format (IANA name with or without abbreviation)
- Exact visual indicator style for unconfigured timezones
- Success indicator style after inline save
- Loading/error states for the inline edit

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants a clean, inline editing experience consistent with the existing admin table patterns.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTimezone` hook (spfx/src/.../hooks/useTimezone.ts): Fully functional, takes IANA timezone, returns formatDateTime/formatDateOnly/formatTimeOnly/timezoneAbbr. Already used across booking views.
- `ILocation.timezone?` optional field: Already in both frontend (models/ILocation.ts) and API (models/Location.ts) models
- DB column: `timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC'` already exists in schema
- `localToUtcIso()`: Converts local time to UTC using IANA timezone, used by BookingForm

### Established Patterns
- Booking views (BookingEntry, VehicleBrowse, VehicleCard, AvailabilityStrip, BookingForm, TeamBookings, AllBookings) already consume `locationTimezone` from API responses
- API joins include `l.timezone AS locationTimezone` in booking/vehicle queries
- Fluent UI DetailsList used for all admin tables (LocationList, FleetManagement, CategoryManagement, AllBookings)
- MessageBar used for success/error feedback in admin views

### Integration Points
- LocationList component (spfx/.../components/LocationList/LocationList.tsx): Needs timezone column + inline edit — currently has no edit capability
- API: No PATCH/PUT endpoint for locations exists — needs new endpoint for timezone updates
- adaptiveCards.ts (api/src/templates/adaptiveCards.ts): Hardcodes `timeZone: 'UTC'` in 3 places — needs to accept location timezone
- emailConfirmation.ts (api/src/templates/emailConfirmation.ts): Hardcodes `timeZone: 'UTC'` — needs to accept location timezone
- reportingService.ts (api/src/services/reportingService.ts): Already joins `l.timezone AS locationTimezone` — may need formatting changes

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-admin-timezone-configuration*
*Context gathered: 2026-03-02*
