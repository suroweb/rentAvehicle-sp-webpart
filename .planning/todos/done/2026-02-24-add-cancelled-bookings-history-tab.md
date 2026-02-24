---
created: 2026-02-24T20:52:33.967Z
title: Add cancelled bookings history tab
area: ui
files:
  - spfx/src/webparts/rentaVehicle/components/MyBookings/MyBookings.tsx
---

## Problem

When a user cancels a booking, it disappears entirely from the My Bookings page. There is no record of cancelled bookings visible to the employee. The Upcoming/Active/Past tabs only show bookings with status=Confirmed. Users have no way to see their cancellation history, which could be useful for reference or auditing.

Identified during Phase 3 UAT (Test 7).

## Solution

Add a "Cancelled" tab to the My Bookings Pivot component that filters bookings by status=Cancelled. Alternatively, show cancelled bookings inline in the Past tab with a visual indicator (e.g. strikethrough or "Cancelled" badge). Backend already stores cancelled bookings in the database — this is a frontend-only change.
