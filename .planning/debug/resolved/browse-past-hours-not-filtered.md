---
status: resolved
trigger: "past hour filtering works on VehicleDetail BookingForm but NOT on Browse Vehicles page"
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: VehicleBrowse.tsx uses raw HOUR_OPTIONS instead of getFilteredHourOptions
test: Compare dropdown options prop in both components
expecting: VehicleBrowse passes HOUR_OPTIONS directly; BookingForm passes filtered version
next_action: CONFIRMED - document root cause

## Symptoms

expected: When today is selected on the Browse Vehicles page, past hours should be filtered out of hour dropdowns
actual: All 24 hours (0:00-23:00) are shown regardless of current time on Browse Vehicles page
errors: none (functional bug, not a crash)
reproduction: Open Browse Vehicles page, leave date as today, open Start time or End time dropdown - all hours visible including past ones
started: Likely since VehicleBrowse was created - getFilteredHourOptions was never added to this component

## Eliminated

(none needed - root cause found on first inspection)

## Evidence

- timestamp: 2026-02-25
  checked: BookingForm.tsx lines 57-73, 165-171
  found: BookingForm defines getFilteredHourOptions() and uses it via useMemo to create startHourOptions and endHourOptions
  implication: VehicleDetail page correctly filters past hours

- timestamp: 2026-02-25
  checked: VehicleBrowse.tsx lines 28-31, 307-314, 329-336
  found: VehicleBrowse defines its own HOUR_OPTIONS (lines 28-31) but NEVER defines or calls getFilteredHourOptions. Lines 311 and 333 pass raw HOUR_OPTIONS directly to Dropdown options prop.
  implication: This is the root cause - no filtering logic exists in VehicleBrowse

## Resolution

root_cause: VehicleBrowse.tsx is missing the getFilteredHourOptions function entirely. The hour dropdowns on lines 311 and 333 pass the raw HOUR_OPTIONS array (all 24 hours) directly, whereas BookingForm.tsx filters them through getFilteredHourOptions() which excludes past hours when today is selected.
fix: Add getFilteredHourOptions to VehicleBrowse.tsx and use filtered options via useMemo (same pattern as BookingForm.tsx)
verification: pending
files_changed: []
