---
created: 2026-02-25T00:55:11.714Z
title: Verify Phase 6 Notifications on live tenant
area: api
files:
  - .planning/phases/06-notifications/06-CONTEXT.md
  - api/src/services/notificationService.ts
  - api/src/functions/notifications.ts
  - api/src/templates/emailConfirmation.ts
  - api/src/templates/adaptiveCards.ts
---

## Problem

Phase 6 (Notifications) was executed through the auto-advance pipeline (discuss → plan → execute) but the verifier agent was NOT run. There is no `06-VERIFICATION.md`. Like Phase 5, this phase requires live M365 tenant testing because all notification channels (Graph API email, Teams activity feed) depend on a configured tenant with real permissions.

Prerequisites before testing:
1. App registration in Entra ID with `Mail.Send` and `TeamsActivity.Send` application permissions (admin consent granted)
2. SPFx solution deployed to a SharePoint tenant
3. Azure Functions deployed with timer trigger enabled for scheduled reminders
4. At least one test booking to trigger confirmation notifications
5. Manager field populated in Entra ID for at least one test user (for NOTF-03)

## Solution

Run the verifier agent to create `06-VERIFICATION.md`, then manually verify on live tenant:

**NOTF-01 — Booking confirmation email:**
1. Create a booking → verify employee receives HTML confirmation email with vehicle details, dates, and action buttons (View Booking + Cancel)

**NOTF-02 — Return reminder:**
2. Create a booking with return time ~1 hour away → verify Teams activity feed notification fires before return time
3. Let a booking go past return time + 15 min → verify overdue notification fires to employee, admin, and manager

**NOTF-03 — Manager notification:**
4. Create a booking as an employee with a manager set in Entra ID → verify manager receives Teams activity feed notification

**NOTF-04 — Teams Adaptive Cards:**
5. Verify all Teams notifications arrive as activity feed items with deep link to booking in webpart
6. Verify confirmation card deep link opens the booking
7. Verify timer-triggered Azure Function runs on schedule (every 5 minutes)

After verification passes, run verifier agent and mark phase 6 as complete.
