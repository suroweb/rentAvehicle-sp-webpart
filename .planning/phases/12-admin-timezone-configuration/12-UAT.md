---
status: complete
phase: 12-admin-timezone-configuration
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md
started: 2026-03-02T10:00:00Z
updated: 2026-03-03T11:54:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Timezone Column Visible in Location List
expected: Navigate to the Locations admin view. The table should show a "Timezone" column between the "Vehicles" and "Status" columns.
result: pass

### 2. UTC Display for Unconfigured Locations
expected: Locations that have not been configured with a timezone display "UTC (not configured)" in italic text with a dashed border on the cell.
result: pass

### 3. Click to Edit Timezone
expected: Clicking a timezone cell opens an inline searchable ComboBox dropdown populated with IANA timezone options (e.g., Europe/Berlin, America/New_York).
result: issue
reported: "when i click it appears like a pre filled input text. i click on it.. then i can add text to the addtional text.. its not user friendly.. and as i type i dont see the the list is filterout.. its the same long list with timezone... we need to fix UX for this. use your frontend skills for this one also."
severity: major

### 4. Search Timezones in ComboBox
expected: Typing in the ComboBox filters the timezone list. For example, typing "Berlin" narrows results to show "Europe/Berlin".
result: issue
reported: "same issue as test 3, doesn't filter"
severity: major

### 5. Auto-Save on Selection
expected: Selecting a timezone from the dropdown triggers an auto-save. A spinner appears briefly in the cell while saving, then a green checkmark appears confirming success.
result: pass

### 6. Saved Timezone Persists After Refresh
expected: After saving a timezone for a location, refreshing the page shows the newly selected timezone (not reverting to UTC).
result: pass

### 7. CSV Export Timezone Formatting
expected: Export raw bookings to CSV from Reports. The CSV should have a "Timezone" column, and start/end times should be formatted in each booking's location timezone with abbreviation (e.g., "Feb 26, 2026, 10:00 AM EET").
result: pass

### 8. Notification Timezone Display
expected: Create a booking at a location with a configured timezone. The email confirmation should show booking times formatted in that location's timezone with a timezone abbreviation (e.g., "10:00 AM EET"), not in UTC.
result: skipped
reason: Email not available in dev environment. Captured as todo for later testing.

## Summary

total: 8
passed: 5
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Clicking a timezone cell opens an inline searchable ComboBox dropdown populated with IANA timezone options"
  status: failed
  reason: "User reported: when i click it appears like a pre filled input text. i click on it.. then i can add text to the addtional text.. its not user friendly.. and as i type i dont see the the list is filterout.. its the same long list with timezone... we need to fix UX for this."
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Typing in the ComboBox filters the timezone list to matching results"
  status: failed
  reason: "User reported: same issue as test 3, doesn't filter"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
