---
created: 2026-03-03T11:53:43.279Z
title: Test email notification timezone display
area: general
files:
  - src/webparts/rentAVehicle/services/NotificationService.ts
---

## Problem

During Phase 12 UAT, Test 8 (Notification Timezone Display) could not be verified because email is not available in the dev environment. Need to verify that booking confirmation emails show times formatted in the location's configured timezone with abbreviation (e.g., "10:00 AM EET") instead of UTC.

## Solution

Set up email testing (e.g., dev SMTP or mock) and verify:
1. Create a booking at a location with a configured timezone
2. Check the email confirmation shows times in the location timezone
3. Verify timezone abbreviation is displayed (e.g., EET, CET, EST)
