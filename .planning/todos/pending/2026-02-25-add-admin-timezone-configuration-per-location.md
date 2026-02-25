---
created: 2026-02-25T20:07:26.978Z
title: Add admin timezone configuration per location
area: ui
files:
  - spfx/src/webparts/rentaVehicle/components/VehicleBrowse/VehicleBrowse.tsx
  - api/src/services/locationService.ts
  - api/setup-db.js
  - spfx/src/webparts/rentaVehicle/hooks/useTimezone.ts
---

## Problem

Locations synced from Entra ID get `timezone = 'UTC'` by default (set in DB schema `DEFAULT 'UTC'`). There is no admin UI to set the correct IANA timezone per location. Currently timezones are hardcoded in `setup-db.js` seed data (`'Europe/Bucharest'` for all locations).

If a new office is added (e.g., Zurich, New York, Tokyo), its vehicles will display and store times using UTC — which is wrong. No warning is shown. An employee could book "09:00" thinking it's local time, but it's actually UTC.

The booking flow itself is already correct: `localToUtcIso()` converts to UTC, database stores UTC, `useTimezone()` hook displays in the vehicle's location timezone via `Intl.DateTimeFormat`. The gap is only in the admin configuration layer.

## Solution

1. **Change DB default:** `timezone` column should default to `NULL` instead of `'UTC'` — NULL means "not configured yet", UTC is a valid timezone
2. **Block vehicle assignment:** API should reject adding vehicles to a location with `timezone = NULL`
3. **Admin UI dropdown:** Add an IANA timezone picker in backoffice location management (common timezones: Europe/Zurich, Europe/Berlin, America/New_York, Asia/Tokyo, etc.)
4. **Warning banner:** Show in backoffice when locations have NULL timezone: "2 locations need timezone configuration"
5. **Cross-location booking is already supported:** VehicleBrowse location dropdown lets any employee pick any location — this todo just ensures the timezone is always correctly set
