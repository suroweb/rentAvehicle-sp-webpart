# Phase 9: Live Tenant Verification Checklist

**Date started:** 2026-02-25
**Status:** In Progress (Section 4 complete)
**Tester:** Automated + Danco Milosevici

---

## Section 1: Environment Setup Checks

### App Registration

- [ ] App registration created in Entra ID
- [ ] Application (client) ID recorded
- [ ] Client secret created and recorded

### Graph API Application Permissions (Admin-consented)

- [ ] Calendars.ReadWrite (create/update calendar events on resource mailboxes and users)
- [ ] Mail.Send (send emails on behalf of any user)
- [ ] User.Read.All (read user profiles and manager info)
- [ ] TeamsActivity.Send (send Teams activity feed notifications -- verify exact permission name in Azure Portal; may be listed as TeamsActivity.Send.User)

### Environment Variables in local.settings.json

- [ ] AZURE_TENANT_ID configured
- [ ] AZURE_CLIENT_ID configured
- [ ] AZURE_CLIENT_SECRET configured
- [ ] NOTIFICATION_SENDER_EMAIL configured (licensed mailbox)
- [ ] APP_BASE_URL configured
- [ ] LOCAL_DEV_EMAIL configured (real tenant user email)
- [ ] LOCAL_DEV_NAME configured (real tenant user name)

### API Build and Startup

- [ ] API builds successfully (`cd api && npm run build`)
- [ ] API starts without Graph auth errors (`cd api && npm start`)

---

## Section 2: Resource Mailbox Setup

- [ ] Equipment mailbox provisioned via PowerShell script or manually in Exchange Online
- [ ] Mailbox email linked to vehicle via PATCH /api/backoffice/vehicles/{id}/mailbox
- [ ] Test vehicle created in the app with resource mailbox email set

---

## Section 3: Test User Setup

- [ ] Test user has valid M365 license (Exchange Online + Teams)
- [ ] Test user's officeLocation matches a location in the app
- [ ] Test user set as own manager in Entra ID (for single-license manager notification testing)

---

## Section 4: Calendar Integration (VRFY-01 + VRFY-02)

*Verified 2026-02-26 via automated API tests against live tenant (contoso.onmicrosoft.com).*

### VRFY-01: Resource Calendar Events

- [x] VRFY-01a: Create booking -> resource calendar event visible in Outlook for vehicle's resource mailbox
  - Booking 1012: Vehicle 1 (Toyota Corolla), resource mailbox car-toyota-camry-test001@contoso.onmicrosoft.com
  - Subject: "Danco Milosevici - Toyota Corolla (B-123-ABC)", times 2026-02-27 09:00-17:00 UTC, location "Bucharest"
  - Body contains HTML table with employee, booking ID, vehicle, category, location details
- [x] VRFY-01b: Cancel booking -> resource calendar event updated with [CANCELLED] prefix
  - Booking 1013: Cancelled via DELETE /api/bookings/1013
  - Resource event subject updated to "[CANCELLED] Danco Milosevici - Toyota Corolla (B-123-ABC)"
  - Body contains [CANCELLED] status banner
- [x] VRFY-01c: Check out booking -> resource calendar event updated with [IN USE] prefix
  - Booking 1015: Checked out via PATCH /api/bookings/1015/checkout
  - Resource event subject updated to "[IN USE] Danco Milosevici - Toyota Corolla (B-123-ABC)"
  - Body contains [IN USE] status banner
- [x] VRFY-01d: Check in booking -> resource calendar event updated with [RETURNED] prefix
  - Booking 1015: Returned via PATCH /api/bookings/1015/return
  - Resource event subject updated to "[RETURNED] Danco Milosevici - Toyota Corolla (B-123-ABC)"
  - Body contains [RETURNED] status banner

### VRFY-02: Personal Calendar Events

- [x] VRFY-02a: Create booking -> personal calendar event visible in employee's Outlook calendar
  - Booking 1012: Employee admin@contoso.onmicrosoft.com
  - Subject: "Vehicle Rental: Toyota Corolla (B-123-ABC)", times 2026-02-27 09:00-17:00 UTC, location "Bucharest"
  - Body contains Vehicle Rental HTML table
- [x] VRFY-02b: Cancel booking -> personal calendar event updated with [CANCELLED] prefix
  - Booking 1013: Employee event subject updated to "[CANCELLED] Vehicle Rental: Toyota Corolla (B-123-ABC)"
  - Body contains [CANCELLED] status banner
- [x] VRFY-02c: Personal calendar event has correct vehicle name, date/time, location in body
  - Booking 1012: Body contains "Toyota Corolla (B-123-ABC)", start/end ISO times, "Bucharest" pickup location, deep link

---

## Section 5: Email Notifications (VRFY-03)

*To be filled during Plan 03 execution.*

- [ ] VRFY-03a: Create booking -> confirmation email arrives in employee's inbox
- [ ] VRFY-03b: Email subject includes vehicle name and location
- [ ] VRFY-03c: Email body includes booking details (vehicle, date/time, location, deep link)

---

## Section 6: Teams Activity Feed (VRFY-04)

*To be filled during Plan 03 execution.*

- [ ] VRFY-04a: Create booking -> activity feed notification appears for the booking employee
- [ ] VRFY-04b: Notification includes vehicle name and booking time in preview text

---

## Section 7: Manager Notifications (VRFY-05)

*To be filled during Plan 03 execution.*

- [ ] VRFY-05a: Create booking -> manager receives Teams activity feed notification
- [ ] VRFY-05b: Manager notification includes employee name and vehicle details

---

## Section 8: Issues Found and Fixes Applied

| # | Issue | Root Cause | Fix Applied | Files Changed |
|---|-------|------------|-------------|---------------|
| 1 | | | | |

---

## Section 9: Sign-Off

- [ ] All VRFY-01 through VRFY-05 sub-checks pass
- Signed off by: ___
- Date: ___
