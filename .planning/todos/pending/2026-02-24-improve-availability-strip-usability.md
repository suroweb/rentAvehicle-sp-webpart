---
created: 2026-02-24T20:53:00.000Z
title: Improve availability strip usability
area: ui
files:
  - spfx/src/webparts/rentaVehicle/components/VehicleDetail/AvailabilityStrip.tsx
  - spfx/src/webparts/rentaVehicle/components/VehicleDetail/BookingForm.tsx
---

## Problem

The 7-day availability strip on the VehicleDetail page only shows the next 7 days from today. If an employee needs to book a vehicle further out (e.g. next month), the strip provides no useful information. The booking form date picker and the availability strip are disconnected — selecting a future date in the form doesn't update the strip's visible range.

Identified during Phase 3 UAT (Tests 4 & 5).

## Solution

Options:
1. Add forward/back arrow buttons to the availability strip so users can navigate week-by-week
2. Sync the strip's visible range with the booking form's selected start date — when the user picks a date in the form, the strip shifts to show that week
3. Both: navigable strip that also auto-syncs with form date selection

Option 3 provides the best UX. The strip should center on the booking form's selected start date when one is chosen, and allow manual week navigation otherwise.
