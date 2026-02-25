# Phase 6: Notifications - Research

**Researched:** 2026-02-25
**Domain:** Microsoft Graph API notifications (email + Teams), Azure Functions timer triggers
**Confidence:** HIGH

## Summary

Phase 6 delivers booking notifications through two M365 channels: email (Graph sendMail) and Teams (activity feed notifications). The existing Graph API infrastructure from Phase 5 (calendarService.ts, graphService.ts) provides the authenticated client pattern. Email notifications use the `POST /users/{id}/sendMail` endpoint with `Mail.Send` application permission. Teams notifications use the activity feed API (`POST /users/{userId}/teamwork/sendActivityNotification`) with `TeamsActivity.Send.User` permission. A timer-triggered Azure Function handles scheduled reminders (pickup, return, overdue). Manager lookup uses `GET /users/{userId}/manager` with existing `User.Read.All` permission.

**Primary recommendation:** Build a `notificationService.ts` that encapsulates email sending and Teams activity feed notification delivery. Wire it fire-and-forget into existing booking endpoints (same pattern as calendarService). Add a timer-triggered Azure Function for scheduled reminders that queries upcoming/overdue bookings and dispatches notifications.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Booking confirmation: Email + Teams Adaptive Card (email for record-keeping, Teams for quick glance)
- Pickup reminder: Teams Adaptive Card only (1 hour before start time)
- Return reminder: Teams Adaptive Card only (1 hour before return time)
- Overdue notification: Teams Adaptive Card to employee, admin, and manager (at return_time + 15 min grace)
- Manager booking alert: Teams Adaptive Card only (real-time, per-booking)
- Fixed behavior for all users -- no per-user notification preference settings
- Pickup reminder: 1 hour before booking start time (Teams only)
- Return reminder: 1 hour before return time (Teams only)
- Overdue notification: 15 minutes after return time passes (with grace period)
- Overdue recipients: employee + admin + manager
- Implementation: scheduled Azure Function for time-based triggers
- Content level: key info only -- vehicle make/model, booking dates, location, plate number
- Full details accessible via "View Booking" deep link to the webpart
- Confirmation card buttons: "View Booking" + "Cancel Booking" (cancel triggers cancellation from Teams)
- Reminder card buttons: "View Booking" + "Check In" (check-in triggers return from Teams)
- Manager card buttons: "View Booking" only (informational, no action)
- Overdue card: informational with "View Booking" link
- Delivery mechanism: Graph API activity feed notifications (no Teams bot registration)
- Triggered individually per booking in real-time (not daily digest)
- Manager determined from Entra ID manager field via Microsoft Graph API
- Informational only -- "View Booking" button, no approve/cancel from card
- Manager also receives overdue alerts for their direct reports

### Claude's Discretion
- Email template design and formatting
- Adaptive Card JSON schema and styling details
- Azure Function scheduling implementation (timer trigger vs queue-based)
- Retry and failure handling for notification delivery
- Graph API activity feed setup details
- How deep links to webpart bookings are constructed

### Deferred Ideas (OUT OF SCOPE)
- Per-user notification preferences (mute, channel choice) -- future phase
- Manager approval workflow for bookings -- separate capability
- Notification history/log viewable in the app -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | Employee receives booking confirmation email via Graph API | Graph sendMail API with Mail.Send application permission; HTML email body with booking details |
| NOTF-02 | Employee receives return reminder before return date/time (scheduled Azure Function) | Timer-triggered Azure Function queries bookings with endTime approaching; dispatches Teams activity feed notification |
| NOTF-03 | Manager receives notification when their employee books a vehicle | Graph API GET /users/{userId}/manager for manager lookup; activity feed notification on booking creation |
| NOTF-04 | Notifications delivered as Teams Adaptive Cards with action buttons | Teams activity feed notifications with deep links to SPFx webpart; email includes actionable message card rendering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @microsoft/microsoft-graph-client | ^3.0.7 | Graph API calls (sendMail, activity feed, manager lookup) | Already in project; official MS SDK |
| @azure/functions | ^4.11.2 | Timer trigger for scheduled notifications | Already in project; v4 programming model |
| @azure/identity | ^4.13.0 | Application credential for Graph API | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mssql | ^12.2.0 | Query bookings for scheduled reminders | Already in project; query upcoming/overdue bookings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Timer trigger | Azure Queue Storage trigger | Queue provides exact-time delivery but adds infrastructure; timer with polling is simpler for this volume |
| Graph sendMail | Azure Communication Services Email | ACS requires separate resource; Graph sendMail reuses existing auth and permissions |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  services/
    notificationService.ts    # Email + Teams notification orchestration
  functions/
    notifications.ts          # Timer-triggered function for reminders
  templates/
    emailConfirmation.ts      # HTML email template builder
    adaptiveCards.ts           # Adaptive Card JSON builders (for email actionable messages)
```

### Pattern 1: Fire-and-Forget Notification Dispatch
**What:** Same pattern used by calendarService.ts -- notification failures never block booking operations.
**When to use:** All real-time notifications (booking confirmation, manager alert).
**Example:**
```typescript
// In bookings.ts createBookingEndpoint, after successful booking:
sendBookingConfirmation(result.id).catch((error) => {
  context.error('Notification failed for booking', result.id, error);
});
```

### Pattern 2: Scheduled Timer Trigger for Reminders
**What:** Azure Functions timer trigger runs every 5 minutes, queries bookings needing reminders.
**When to use:** Pickup reminders (1h before start), return reminders (1h before end), overdue (15min after end).
**Example:**
```typescript
// Azure Functions v4 timer trigger
import { app, Timer, InvocationContext } from '@azure/functions';

app.timer('notificationTimer', {
  schedule: '0 */5 * * * *', // Every 5 minutes
  handler: async (timer: Timer, context: InvocationContext) => {
    await processPickupReminders();
    await processReturnReminders();
    await processOverdueNotifications();
  },
});
```

### Pattern 3: Graph API Email (sendMail)
**What:** Send HTML email via Graph API using application permissions.
**When to use:** Booking confirmation email.
**Example:**
```typescript
// POST /users/{senderEmail}/sendMail with Mail.Send application permission
const client = await getGraphClient();
await client.api(`/users/${senderEmail}/sendMail`).post({
  message: {
    subject: 'Booking Confirmation: Toyota Camry (ABC-123)',
    body: { contentType: 'HTML', content: htmlBody },
    toRecipients: [{ emailAddress: { address: employeeEmail } }],
  },
  saveToSentItems: false,
});
```

### Pattern 4: Teams Activity Feed Notification
**What:** Send activity feed notification to Teams activity panel via Graph API.
**When to use:** All Teams notifications (reminders, manager alerts, overdue).
**Example:**
```typescript
// POST /users/{userId}/teamwork/sendActivityNotification
// Requires TeamsActivity.Send.User application permission
// Requires Teams app manifest with activity types defined
const client = await getGraphClient();
await client.api(`/users/${userId}/teamwork/sendActivityNotification`).post({
  topic: {
    source: 'text',
    value: 'RentAVehicle Booking',
    webUrl: `${appBaseUrl}?bookingId=${bookingId}`,
  },
  activityType: 'bookingConfirmation',
  previewText: { content: `Your booking for ${vehicleName} is confirmed` },
  templateParameters: [
    { name: 'vehicleName', value: vehicleName },
    { name: 'bookingDate', value: formattedDate },
  ],
});
```

### Pattern 5: Manager Lookup via Graph API
**What:** Get a user's manager from Entra ID for manager notifications.
**When to use:** On booking creation, to notify the employee's manager.
**Example:**
```typescript
// GET /users/{userId}/manager with User.Read.All permission
const client = await getGraphClient();
try {
  const manager = await client.api(`/users/${userId}/manager`).get();
  return { id: manager.id, email: manager.mail, displayName: manager.displayName };
} catch {
  // User may not have a manager assigned -- not an error
  return null;
}
```

### Pattern 6: Reminder Tracking with Database Flag
**What:** Track which reminders have been sent to avoid duplicates on timer re-runs.
**When to use:** All scheduled reminders.
**Example:**
```sql
-- Add columns to track reminder delivery
ALTER TABLE Bookings ADD pickupReminderSentAt DATETIME2 NULL;
ALTER TABLE Bookings ADD returnReminderSentAt DATETIME2 NULL;
ALTER TABLE Bookings ADD overdueNotificationSentAt DATETIME2 NULL;
```

### Anti-Patterns to Avoid
- **Blocking booking creation on notification failure:** Notifications are secondary -- booking is the primary operation. Always fire-and-forget.
- **Sending reminders on every timer tick:** Must track sent state in DB. Without tracking, users get spammed every 5 minutes.
- **Looking up manager on every reminder tick:** Cache manager info or look up once at booking creation time and store.
- **Using bot framework for simple notifications:** Activity feed + sendMail covers requirements without bot registration overhead.

## Teams Activity Feed vs Adaptive Cards -- Architecture Decision

### The Challenge
The user requested "Adaptive Cards with action buttons" and "Graph API activity feed notifications (no Teams bot registration)." These are partially in tension:
- **Teams activity feed notifications** appear as text-based items in the Teams Activity panel. They support deep links but NOT rich Adaptive Card rendering or action buttons within the notification itself.
- **Rich Adaptive Cards with Action.Submit** require a Teams bot or Incoming Webhook connector.

### Recommended Approach
1. **Email confirmation**: HTML email with embedded actionable message card (Outlook Actionable Messages) for "View Booking" and "Cancel Booking" deep links. The email itself is the rich, detailed notification with buttons.
2. **Teams notifications**: Activity feed notifications that appear natively in the Teams Activity panel with deep links to the SPFx webpart. Clicking the notification opens the booking in the webpart where users can take action (cancel, check in, etc.).
3. **Action buttons are deep links**: "View Booking" = deep link to SPFx tab/page with `?bookingId=N`. "Cancel Booking" and "Check In" = deep links to the booking detail in the webpart where the existing UI buttons handle the action.

### Why This Works
- Activity feed notifications are native to M365 -- they appear in Teams Activity, trigger OS-level push notifications on mobile/desktop, and feel natural.
- Deep links to the SPFx webpart provide the full interactive experience (cancel, check-in, etc.) using already-built UI.
- No bot registration, no bot framework dependency, no app store submission required.
- The email serves as the "rich card" with full booking details and actionable buttons (via Outlook Actionable Messages or simple mailto/URL buttons).

### Teams App Manifest Requirement
Activity feed notifications require a Teams app manifest with:
1. `webApplicationInfo` section with the Entra ID app registration ID
2. `activities.activityTypes` array defining notification types
3. The app must be installed for the recipient (can be pre-installed via Teams admin policy)

This is the existing SPFx webpart's Teams manifest (already deployed as a Teams tab in Phase 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML templates | Raw string concatenation | Template builder functions with escapeHtml | XSS prevention, maintainability |
| Scheduled job coordination | Custom cron/setInterval in Azure Function | Native timer trigger with NCRONTAB | Reliable scheduling, handles missed runs |
| Duplicate reminder prevention | In-memory tracking | Database flag columns (sentAt timestamps) | Survives function restarts, multiple instances |
| Manager hierarchy lookup | Custom org chart traversal | Graph API /users/{id}/manager | Single call, always current from Entra ID |

**Key insight:** The existing project patterns (fire-and-forget, Graph client, database queries) apply directly. No new paradigms needed.

## Common Pitfalls

### Pitfall 1: Timer Function Running in Multiple Instances
**What goes wrong:** Azure Functions can scale to multiple instances, each running the timer. Reminders get sent 2-3x.
**Why it happens:** Timer triggers run independently per instance by default.
**How to avoid:** Use database-level `sentAt` flag with atomic UPDATE...WHERE sentAt IS NULL. Only the first instance to update wins.
**Warning signs:** Users report duplicate notifications.

### Pitfall 2: sendMail Requires a Real User Mailbox
**What goes wrong:** `POST /users/{id}/sendMail` fails with 404 if the sender isn't a licensed user with a mailbox.
**Why it happens:** Application permissions allow sending "as" any user, but the user must have an Exchange Online mailbox.
**How to avoid:** Use a dedicated service account or shared mailbox (e.g., `no-reply@contoso.com` or `rentavehicle@contoso.com`) as the sender. Configure via environment variable.
**Warning signs:** 404 or "MailboxNotFound" errors from Graph API.

### Pitfall 3: Manager May Not Exist
**What goes wrong:** `GET /users/{userId}/manager` returns 404 if no manager is assigned in Entra ID.
**Why it happens:** Not all users have a manager set in the directory.
**How to avoid:** Wrap manager lookup in try/catch, treat 404 as "no manager" (not an error). Skip manager notification silently.
**Warning signs:** Unhandled 404 errors breaking notification flow.

### Pitfall 4: Activity Feed Requires Teams App Installation
**What goes wrong:** `POST /users/{id}/teamwork/sendActivityNotification` fails if the Teams app isn't installed for the user.
**Why it happens:** Activity feed notifications are scoped to installed apps.
**How to avoid:** Pre-install the Teams app via admin policy (Teams Admin Center > Setup policies). Wrap in try/catch for users without the app. Fall back to email-only.
**Warning signs:** "AppNotInstalled" or 403 errors from activity feed API.

### Pitfall 5: Timer Function NCRONTAB Format Difference
**What goes wrong:** Azure Functions uses 6-field NCRONTAB (with seconds), not standard 5-field cron.
**Why it happens:** Azure Functions NCRONTAB includes a seconds field: `{second} {minute} {hour} {day} {month} {day-of-week}`.
**How to avoid:** Always include 6 fields. `0 */5 * * * *` = every 5 minutes (correct). `*/5 * * * *` = wrong (5-field).
**Warning signs:** Function throws "Invalid CRON expression" on startup.

### Pitfall 6: Graph API Rate Limiting for Bulk Notifications
**What goes wrong:** Sending many notifications at once (overdue check, batch reminders) hits Graph API throttling (429 responses).
**Why it happens:** Graph API per-app limits: ~10,000 requests per 10 minutes for Mail.Send; activity feed has similar limits.
**How to avoid:** Process reminders in batches with delay between batches (same pattern as Phase 5 calendar backfill). For the expected booking volume, this is unlikely to be an issue, but build the batching in from the start.
**Warning signs:** 429 Too Many Requests responses from Graph API.

## Code Examples

### Graph API sendMail with Application Permissions
```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/user-sendmail
// Permission: Mail.Send (application)
// Sender must have an Exchange Online mailbox

const client = await getGraphClient();
const senderEmail = process.env.NOTIFICATION_SENDER_EMAIL || 'no-reply@contoso.com';

await client.api(`/users/${senderEmail}/sendMail`).post({
  message: {
    subject: 'Booking Confirmation: Toyota Camry (ABC-123)',
    body: {
      contentType: 'HTML',
      content: buildConfirmationEmailHtml(booking, vehicle),
    },
    toRecipients: [
      { emailAddress: { address: booking.userEmail } },
    ],
  },
  saveToSentItems: false,
});
```

### Teams Activity Feed Notification
```typescript
// Source: https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications
// Permission: TeamsActivity.Send.User (application)
// Requires Teams app installed for user

const client = await getGraphClient();
await client.api(`/users/${userId}/teamwork/sendActivityNotification`).post({
  topic: {
    source: 'text',
    value: 'Vehicle Booking',
    webUrl: `${appBaseUrl}?bookingId=${bookingId}`,
  },
  activityType: 'bookingConfirmed',
  previewText: {
    content: `Booking confirmed: ${vehicleMake} ${vehicleModel} (${licensePlate})`,
  },
  templateParameters: [
    { name: 'vehicleName', value: `${vehicleMake} ${vehicleModel}` },
    { name: 'dates', value: `${startDate} - ${endDate}` },
  ],
});
```

### Manager Lookup
```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/user-list-manager
// Permission: User.Read.All (already granted)

async function getManagerInfo(userId: string): Promise<{ id: string; email: string; displayName: string } | null> {
  try {
    const client = await getGraphClient();
    const manager = await client
      .api(`/users/${userId}/manager`)
      .select('id,mail,displayName')
      .get();
    if (!manager?.mail) return null;
    return { id: manager.id, email: manager.mail, displayName: manager.displayName };
  } catch {
    return null; // No manager assigned -- not an error
  }
}
```

### Azure Functions Timer Trigger (v4 TypeScript)
```typescript
// Source: https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer
import { app, Timer, InvocationContext } from '@azure/functions';

async function processNotifications(timer: Timer, context: InvocationContext): Promise<void> {
  if (timer.isPastDue) {
    context.log('Timer is past due -- processing missed notifications');
  }
  await processPickupReminders(context);
  await processReturnReminders(context);
  await processOverdueNotifications(context);
}

app.timer('notificationTimer', {
  schedule: '0 */5 * * * *', // Every 5 minutes (6-field NCRONTAB)
  handler: processNotifications,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Outlook Actionable Messages (legacy) | Graph sendMail + HTML email | 2023+ | sendMail is simpler, no actionable message provider registration needed |
| Teams Bot Framework for notifications | Activity feed API + deep links | 2022+ | No bot registration, native M365 feel |
| Incoming Webhooks for Teams | Activity feed API | 2024+ | Webhooks being deprecated; activity feed is the recommended path |

**Deprecated/outdated:**
- Office 365 Connectors (deprecated as of 2024, replaced by Workflows and activity feed)
- Incoming Webhooks for new apps (Microsoft recommending migration to Workflows)

## Open Questions

1. **Sender mailbox for notification emails**
   - What we know: Graph sendMail requires a real mailbox as sender
   - What's unclear: Which mailbox to use (shared mailbox, service account, etc.)
   - Recommendation: Use environment variable `NOTIFICATION_SENDER_EMAIL`. Default to a shared mailbox like `rentavehicle@{tenant}.onmicrosoft.com`. Document as admin setup step.

2. **Teams app manifest for activity feed**
   - What we know: Activity feed requires activity types defined in manifest
   - What's unclear: Whether the existing SPFx Teams manifest supports custom activity types
   - Recommendation: Add activity types to the existing Teams app manifest during implementation. If manifest changes require redeployment, document as admin step.

3. **Admin user IDs for overdue notifications**
   - What we know: Overdue notifications go to employee + admin + manager
   - What's unclear: Which admin(s) receive overdue alerts -- all admins? Location-specific admins?
   - Recommendation: Use a configurable admin email (environment variable `OVERDUE_ADMIN_EMAIL`) for simplicity. Can be expanded later.

## Sources

### Primary (HIGH confidence)
- [Graph API sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail) - Application permission: Mail.Send, endpoint format, HTML body support
- [Teams Activity Feed Notifications](https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications) - TeamsActivity.Send.User permission, manifest requirements, deep links
- [Azure Functions Timer Trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer) - NCRONTAB format, v4 TypeScript API, isPastDue handling
- [Graph API User Manager](https://learn.microsoft.com/en-us/graph/api/user-list-manager) - GET /users/{id}/manager, User.Read.All permission

### Secondary (MEDIUM confidence)
- [Teams Activity Feed Best Practices](https://learn.microsoft.com/en-us/graph/teams-activity-feed-notifications-best-practices) - Batching, throttling, user experience guidance
- [Graph API Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference) - Mail.Send, TeamsActivity.Send.User application permission details

### Tertiary (LOW confidence)
- Activity feed notification with custom icons and rich templates -- may require beta API or specific manifest versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing project libraries, no new dependencies
- Architecture: HIGH - follows established fire-and-forget pattern from calendarService
- Pitfalls: HIGH - verified against official docs, common issues well-documented
- Teams activity feed vs Adaptive Cards: MEDIUM - activity feed confirmed as text-based; deep link approach verified but action button UX differs from traditional Adaptive Cards

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable APIs, 30-day validity)
