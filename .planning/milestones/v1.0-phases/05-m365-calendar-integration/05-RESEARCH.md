# Phase 5: M365 Calendar Integration - Research

**Researched:** 2026-02-25
**Domain:** Microsoft Graph API calendar operations, Exchange Online resource mailboxes
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Vehicle resource calendar title**: Full context format -- `Dan Comilosevici - Toyota Camry (ABC-123)`
- **Vehicle resource calendar body**: Booking essentials (employee name, email, department, booking ID, pickup/return times) plus vehicle details (make/model/plate/location/category)
- **Employee personal calendar title**: Employee-focused -- `Vehicle Rental: Toyota Camry (ABC-123)`
- **Employee personal calendar body**: Pickup-focused -- vehicle details (make/model/plate), pickup location, return time, and a deep link back to the booking in the app
- **Location field**: Set to the vehicle's office location (e.g. 'Bucharest Office')
- **Employee event show-as**: Marked as **Free** -- does not affect Teams presence or Outlook availability
- **Timing**: Real-time -- calendar events created/updated immediately when booking actions happen
- **Booking creation**: Creates events on both vehicle resource calendar and employee personal calendar
- **Cancellation**: Updates both events to show 'CANCELLED' in title/body (events are NOT deleted -- audit trail preserved)
- **Check-out**: Updates both events to reflect 'IN USE' status
- **Check-in/return**: Updates both events to reflect 'RETURNED' status
- **Time modification**: Calendar event start/end times updated to match booking changes
- **Admin override/cancel**: Same cancellation behavior -- both events updated
- **Access**: All employees can view vehicle resource calendars in Outlook with full details
- **Organization**: Resource calendars grouped by office location in Outlook (e.g. 'Bucharest Vehicles', 'Cluj Vehicles')
- **Provisioning**: Auto-provision Exchange equipment mailbox when admin adds a new vehicle in the app
- **Backfill**: On Phase 5 deployment, create resource mailboxes for all existing vehicles and sync their active bookings to calendar events
- **Direct booking prevention**: Resource mailboxes configured to auto-decline meeting requests NOT sent by the app's service account -- app is the only way to book
- **Event duration**: Spans full booking period (pickup to return)
- **Reminder**: 30-minute Outlook reminder before pickup time
- **Status updates**: All status changes (check-out, return, cancellation) reflected on the employee's personal calendar event
- **Deep link**: Event body includes a link back to the booking in the app
- **Employee's personal calendar event must show as Free** to avoid messing up Teams status
- **The app is the system of record** -- Outlook calendars are a read-only projection
- **Vehicle resource calendars should be browsable** by all employees for transparency

### Claude's Discretion
- Exchange resource mailbox naming convention and display name format
- Exact HTML/text formatting of event bodies
- Error handling when Graph API calls fail during sync
- Calendar category/color coding approach
- How to handle the backfill migration (batch size, rate limiting)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| M365-01 | Each vehicle has an Exchange equipment mailbox with a resource calendar | Graph API cannot create mailboxes -- must use Exchange Online PowerShell `New-Mailbox -Equipment` or delegate to an admin API endpoint that calls PowerShell. Research covers alternative: app calls Graph API to create events directly on pre-provisioned equipment mailboxes. |
| M365-02 | Booking creates a calendar event on the vehicle's resource calendar (visible in Outlook) | Graph API `POST /users/{resourceMailboxId}/events` with `Calendars.ReadWrite` application permission creates events directly on the resource mailbox calendar. No invitation workflow needed. |
| M365-03 | Booking creates a calendar event on the employee's personal Outlook calendar | Graph API `POST /users/{employeeId}/events` with `Calendars.ReadWrite` application permission creates events directly on the employee's calendar. Set `showAs: 'free'` and `reminderMinutesBeforeStart: 30`. |
</phase_requirements>

## Summary

This phase integrates the RentAVehicle booking system with Microsoft 365 calendars via the Microsoft Graph API. The core architecture is a **write-through display layer**: the Azure SQL database remains the system of record, and every booking lifecycle event (create, cancel, check-out, check-in) pushes corresponding calendar event updates to two places -- the vehicle's Exchange equipment mailbox calendar and the employee's personal Outlook calendar.

The project already has `@microsoft/microsoft-graph-client` v3.0.7 and `@azure/identity` installed, with an existing `graphService.ts` that handles authentication (ClientSecretCredential for local dev, DefaultAzureCredential for production). This service currently only fetches user office locations. Phase 5 extends it to perform calendar CRUD operations using application permissions (`Calendars.ReadWrite`).

The key architectural challenge is that **equipment mailbox creation cannot be done via Graph API** -- it requires Exchange Online PowerShell (`New-Mailbox -Equipment`). The recommended approach is to provision equipment mailboxes as an admin setup step (either manually or via a PowerShell script triggered by the app), and then use Graph API for all calendar event operations. The app stores the resource mailbox email address (or user ID) in the Vehicles table, enabling direct Graph API calls to create/update events on that mailbox's calendar.

**Primary recommendation:** Create a `calendarService.ts` that wraps Graph API calendar operations (create event, update event) for both resource mailboxes and employee calendars. Integrate it into existing booking service methods as a post-commit side effect (fire-and-forget with error logging, never blocking the booking transaction).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@microsoft/microsoft-graph-client` | ^3.0.7 | Graph API HTTP client | Already in project; official Microsoft SDK |
| `@azure/identity` | ^4.13.0 | Token acquisition for Graph API | Already in project; handles both local dev and production auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mssql` | ^12.2.0 | Azure SQL for storing calendar event IDs | Already in project; stores eventId mappings for later updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Graph client calls | Microsoft Graph SDK for JS (`@microsoft/msgraph-sdk`) | The typed SDK is heavier; the existing raw client pattern in graphService.ts is lightweight and sufficient. Keep consistency with existing code. |
| Exchange Online PowerShell for mailbox creation | Graph API beta `/places` endpoint | Beta endpoints are not stable; PowerShell is the documented production path for mailbox creation |

**Installation:**
No additional packages needed. All required dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── services/
│   ├── graphService.ts          # Existing: getGraphClient(), getDistinctOfficeLocations()
│   ├── calendarService.ts       # NEW: createVehicleCalendarEvent(), createEmployeeCalendarEvent(),
│   │                            #       updateCalendarEvent(), calendar provisioning helpers
│   ├── bookingService.ts        # MODIFIED: call calendarService after booking mutations
│   └── vehicleService.ts        # MODIFIED: trigger mailbox provisioning on vehicle create
├── functions/
│   ├── bookings.ts              # MODIFIED: no endpoint changes, calendar sync is server-side
│   ├── adminBookings.ts         # MODIFIED: admin cancel triggers calendar updates
│   └── calendarAdmin.ts         # NEW: admin endpoint for backfill migration + provisioning status
├── models/
│   └── Booking.ts               # MODIFIED: add calendarEventId fields to IBooking
└── sql/
    └── schema.sql               # MODIFIED: add resourceMailboxEmail to Vehicles,
                                 #           vehicleCalendarEventId + employeeCalendarEventId to Bookings
```

### Pattern 1: Two Separate Events (Not Invitation-Based)
**What:** Create two independent calendar events using application permissions -- one directly on the vehicle resource mailbox calendar and one directly on the employee's personal calendar. Do NOT use the invitation/attendee pattern.
**When to use:** Always. This is the correct pattern for application-permissions-based calendar management.
**Why:** When using application permissions (`Calendars.ReadWrite`), creating an event with attendees does NOT send invitation emails and does NOT add events to attendees' calendars. The attendee model only works with delegated permissions. Instead, create events directly on each target mailbox calendar.

**Example:**
```typescript
// Source: Microsoft Graph API docs - POST /users/{id}/events
// https://learn.microsoft.com/en-us/graph/api/user-post-events

// Create event on VEHICLE resource mailbox calendar
const vehicleEvent = await graphClient
  .api(`/users/${resourceMailboxEmail}/events`)
  .post({
    subject: `${employeeName} - ${vehicleMake} ${vehicleModel} (${licensePlate})`,
    body: {
      contentType: 'HTML',
      content: buildVehicleEventBody(booking, vehicle),
    },
    start: {
      dateTime: booking.startTime, // ISO without Z suffix
      timeZone: 'UTC',
    },
    end: {
      dateTime: booking.endTime,
      timeZone: 'UTC',
    },
    location: {
      displayName: vehicle.locationName,
    },
    showAs: 'busy', // Vehicle IS busy during this time
    isReminderOn: false, // No reminders on resource calendars
  });

// Create event on EMPLOYEE personal calendar
const employeeEvent = await graphClient
  .api(`/users/${employeeEmail}/events`)
  .post({
    subject: `Vehicle Rental: ${vehicleMake} ${vehicleModel} (${licensePlate})`,
    body: {
      contentType: 'HTML',
      content: buildEmployeeEventBody(booking, vehicle),
    },
    start: {
      dateTime: booking.startTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: booking.endTime,
      timeZone: 'UTC',
    },
    location: {
      displayName: vehicle.locationName,
    },
    showAs: 'free', // Does NOT block employee's availability
    isReminderOn: true,
    reminderMinutesBeforeStart: 30,
  });

// Store event IDs for later updates
await saveCalendarEventIds(bookingId, vehicleEvent.id, employeeEvent.id);
```

### Pattern 2: Fire-and-Forget Calendar Sync with Error Logging
**What:** Calendar operations execute after the database transaction commits, as non-blocking side effects. Failures are logged but do not roll back the booking.
**When to use:** All booking lifecycle events (create, cancel, checkout, checkin).
**Why:** The database is the system of record. Calendar events are a read-only projection. A Graph API timeout or error should never prevent a booking from succeeding.

**Example:**
```typescript
// In createBooking endpoint, after successful DB insert:
const result = await createBooking(vehicleId, userId, userEmail, ...);
if ('id' in result) {
  // Fire-and-forget: sync to calendars
  syncBookingToCalendars(result.id, 'created').catch((error) => {
    context.error('Calendar sync failed for booking', result.id, error);
    // TODO: queue for retry or mark as out-of-sync
  });
  return { status: 201, jsonBody: { id: result.id } };
}
```

### Pattern 3: Event Update (Not Delete+Create)
**What:** Use `PATCH /users/{id}/events/{eventId}` to update existing events when booking status changes. Never delete events (audit trail requirement).
**When to use:** Cancellation, check-out, check-in, time modifications.

**Example:**
```typescript
// Source: Microsoft Graph API docs - PATCH /users/{id}/events/{eventId}
// https://learn.microsoft.com/en-us/graph/api/event-update

// Update vehicle calendar event on cancellation
await graphClient
  .api(`/users/${resourceMailboxEmail}/events/${vehicleCalendarEventId}`)
  .patch({
    subject: `[CANCELLED] ${originalSubject}`,
    body: {
      contentType: 'HTML',
      content: buildCancelledEventBody(booking, vehicle, cancelReason),
    },
  });

// Update employee calendar event on cancellation
await graphClient
  .api(`/users/${employeeEmail}/events/${employeeCalendarEventId}`)
  .patch({
    subject: `[CANCELLED] Vehicle Rental: ${vehicleMake} ${vehicleModel} (${licensePlate})`,
    body: {
      contentType: 'HTML',
      content: buildCancelledEmployeeEventBody(booking, vehicle, cancelReason),
    },
  });
```

### Pattern 4: Database Schema Extension
**What:** Add columns to store the mapping between bookings and their corresponding calendar event IDs.

**SQL changes:**
```sql
-- Add resource mailbox email to Vehicles table
ALTER TABLE Vehicles ADD resourceMailboxEmail NVARCHAR(255) NULL;

-- Add calendar event IDs to Bookings table
ALTER TABLE Bookings ADD vehicleCalendarEventId NVARCHAR(255) NULL;
ALTER TABLE Bookings ADD employeeCalendarEventId NVARCHAR(255) NULL;
```

### Anti-Patterns to Avoid
- **Invitation-based events with application permissions:** Creating an event with attendees using app permissions does NOT send invitation emails and does NOT propagate events to attendee calendars. Always create events directly on each target calendar.
- **Blocking booking on calendar failure:** Never make the booking transaction depend on Graph API success. Calendar is a projection, not the source of truth.
- **Deleting calendar events:** User decision: events are never deleted. On cancellation, update the title/body to show CANCELLED status.
- **Creating equipment mailboxes via Graph API:** Graph API does not support creating Exchange mailboxes. Use Exchange Online PowerShell.
- **Per-request token acquisition:** The existing graphService.ts acquires a token per call. For high-frequency calendar operations, consider caching the Graph client instance (the existing pattern already does this adequately since `getGraphClient()` creates a new client per call, and token caching is handled by `@azure/identity` internally).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar event CRUD | Custom HTTP calls to Graph REST API | `@microsoft/microsoft-graph-client` `.api().post()/.patch()` | Handles auth headers, retries, error responses |
| Token acquisition | Manual OAuth2 token fetch | `@azure/identity` `ClientSecretCredential` / `DefaultAzureCredential` | Already working in project; handles token caching and refresh |
| HTML event body generation | String concatenation | Template function with proper HTML escaping | Prevent XSS in Outlook rendering; maintain consistent formatting |
| Equipment mailbox creation | Graph API workarounds | Exchange Online PowerShell `New-Mailbox -Equipment` | Only supported path; Graph API lacks this capability |
| Calendar booking policy | Custom decline logic | Exchange `Set-CalendarProcessing -BookInPolicy` | Exchange handles auto-decline natively; no app code needed |

**Key insight:** The Graph API is excellent for calendar event CRUD but cannot manage Exchange mailbox provisioning. Accept this boundary and use PowerShell for mailbox setup, Graph API for event operations.

## Common Pitfalls

### Pitfall 1: Application Permissions Don't Send Invitations
**What goes wrong:** Developer creates an event with attendees using application permissions, expecting the attendees to receive calendar invitations. The event is created successfully (201 response) but attendees never see it in their calendars.
**Why it happens:** Application permissions bypass the Exchange invitation workflow. Events are only created in the organizer's (specified user's) calendar, not attendees'.
**How to avoid:** Create two separate events -- one via `POST /users/{resourceMailboxEmail}/events` and one via `POST /users/{employeeEmail}/events`. No attendees list needed.
**Warning signs:** 201 success response but events missing from expected calendars.

### Pitfall 2: Graph API Token Scope
**What goes wrong:** Calendar operations fail with 403 Forbidden despite having `Calendars.ReadWrite` configured.
**Why it happens:** The existing `getGraphClient()` acquires a token for `https://graph.microsoft.com/.default` scope, which should include all configured application permissions. But the app registration in Entra ID may not have `Calendars.ReadWrite` application permission granted with admin consent.
**How to avoid:** Verify the Entra ID app registration has `Calendars.ReadWrite` application permission (not just delegated), and admin consent has been granted. The existing token acquisition code is correct and needs no changes.
**Warning signs:** 403 errors specifically on calendar operations while other Graph calls (like user queries) succeed.

### Pitfall 3: Equipment Mailbox Does Not Have a User ID
**What goes wrong:** Code tries to use a vehicle's resource mailbox email with Graph API but gets 404 because equipment mailboxes don't appear as regular users.
**Why it happens:** Equipment mailboxes are Exchange resources, not Entra ID users. However, they ARE addressable via Graph API using their email address in the `/users/{email}` path.
**How to avoid:** Use the resource mailbox's email address (e.g., `car-toyota-camry-abc123@contoso.com`) as the `{id}` parameter in Graph API calls. Graph API resolves both UPNs and email addresses for Exchange mailboxes.
**Warning signs:** 404 when using an object ID that doesn't exist; switch to using the email address directly.

### Pitfall 4: Token Caching and Rate Limits
**What goes wrong:** Creating bookings becomes slow because each calendar sync acquires a new token, or Graph API returns 429 Too Many Requests during backfill migration.
**Why it happens:** `@azure/identity` credentials cache tokens internally, so per-call token acquisition is not actually a performance issue. But Graph API throttling (10,000 requests per 10 minutes per app per tenant) can hit during bulk operations.
**How to avoid:** For normal operations (1-2 events per booking), throttling is not a concern. For the backfill migration, implement batch processing with delays between batches (e.g., 50 bookings, then pause 5 seconds). Graph API returns a `Retry-After` header on 429 responses -- honor it.
**Warning signs:** 429 responses during bulk operations.

### Pitfall 5: Resource Mailbox Calendar Visibility
**What goes wrong:** Employees cannot see vehicle resource calendars in Outlook.
**Why it happens:** By default, resource calendars may have restricted visibility. The default `calendarPermissions` for equipment mailboxes may only show free/busy information, not full event details.
**How to avoid:** After creating each equipment mailbox, update its calendar permissions via Exchange PowerShell: `Set-MailboxFolderPermission -Identity "car@contoso.com:\Calendar" -User Default -AccessRights Reviewer`. The "Reviewer" access right lets all users in the org read full event details. This is a one-time setup per mailbox.
**Warning signs:** Users can see the resource calendar but events show as "busy" blocks without titles or details.

### Pitfall 6: Backfill Migration Race Conditions
**What goes wrong:** During backfill, new bookings are being created simultaneously, leading to duplicate or missing calendar events.
**Why it happens:** The backfill reads all existing bookings and syncs them, but new bookings coming in during the backfill may or may not have calendar events depending on timing.
**How to avoid:** Two-phase approach: (1) Deploy code that creates calendar events for all new bookings going forward. (2) Run backfill migration for bookings that don't have `vehicleCalendarEventId` set (use NULL check as the filter). The backfill is idempotent because it only processes bookings without event IDs.
**Warning signs:** Bookings with calendar events created twice (duplicate events in Outlook).

## Code Examples

Verified patterns from official sources:

### Creating a Graph Client (Existing Pattern)
```typescript
// Source: Existing api/src/services/graphService.ts
// Auth modes already handled: ClientSecretCredential (local) vs DefaultAzureCredential (prod)
import { Client } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';

async function getGraphClient(): Promise<Client> {
  let credential;
  if (process.env.AZURE_CLIENT_SECRET) {
    credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID || '',
      process.env.AZURE_CLIENT_ID || '',
      process.env.AZURE_CLIENT_SECRET
    );
  } else {
    credential = new DefaultAzureCredential();
  }

  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  if (!tokenResponse) throw new Error('Failed to acquire Graph API token');

  return Client.init({
    authProvider: (done) => { done(null, tokenResponse.token); },
  });
}
```

### Creating an Event on a User/Resource Calendar
```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/user-post-events
// POST /users/{id | userPrincipalName}/events
// Permission: Calendars.ReadWrite (Application)

interface CalendarEventInput {
  subject: string;
  bodyHtml: string;
  startDateTime: string; // ISO 8601 without Z, e.g. "2026-03-15T09:00:00"
  endDateTime: string;
  timeZone: string;      // e.g. "UTC"
  locationDisplayName: string;
  showAs: 'free' | 'busy' | 'tentative' | 'oof' | 'workingElsewhere';
  isReminderOn: boolean;
  reminderMinutesBeforeStart?: number;
  categories?: string[];
}

async function createCalendarEvent(
  userIdOrEmail: string,
  input: CalendarEventInput
): Promise<{ id: string; iCalUId: string }> {
  const client = await getGraphClient();

  const event = await client
    .api(`/users/${userIdOrEmail}/events`)
    .post({
      subject: input.subject,
      body: {
        contentType: 'HTML',
        content: input.bodyHtml,
      },
      start: {
        dateTime: input.startDateTime,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: input.timeZone,
      },
      location: {
        displayName: input.locationDisplayName,
      },
      showAs: input.showAs,
      isReminderOn: input.isReminderOn,
      reminderMinutesBeforeStart: input.reminderMinutesBeforeStart || 0,
      categories: input.categories || [],
    });

  return { id: event.id, iCalUId: event.iCalUId };
}
```

### Updating an Existing Calendar Event
```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/event-update
// PATCH /users/{id}/events/{eventId}
// Permission: Calendars.ReadWrite (Application)

async function updateCalendarEvent(
  userIdOrEmail: string,
  eventId: string,
  updates: Partial<{
    subject: string;
    bodyHtml: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
  }>
): Promise<void> {
  const client = await getGraphClient();

  const patchBody: Record<string, unknown> = {};
  if (updates.subject) patchBody.subject = updates.subject;
  if (updates.bodyHtml) {
    patchBody.body = { contentType: 'HTML', content: updates.bodyHtml };
  }
  if (updates.startDateTime) {
    patchBody.start = { dateTime: updates.startDateTime, timeZone: updates.timeZone || 'UTC' };
  }
  if (updates.endDateTime) {
    patchBody.end = { dateTime: updates.endDateTime, timeZone: updates.timeZone || 'UTC' };
  }

  await client
    .api(`/users/${userIdOrEmail}/events/${eventId}`)
    .patch(patchBody);
}
```

### Equipment Mailbox Provisioning (PowerShell -- Admin Setup)
```powershell
# Source: https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes
# Run via Exchange Online PowerShell module

# Create equipment mailbox for a vehicle
New-Mailbox -Equipment `
  -Name "Toyota Camry (ABC-123) - Bucharest" `
  -DisplayName "Toyota Camry (ABC-123) - Bucharest" `
  -Alias "car-toyota-camry-abc123"

# Configure calendar processing to auto-decline external bookings
# Only the app's service principal can book
Set-CalendarProcessing -Identity "car-toyota-camry-abc123" `
  -AutomateProcessing AutoAccept `
  -AllBookInPolicy $false `
  -BookInPolicy "rentavehicle-app@contoso.com" `
  -AllowConflicts $false

# Grant all users read access to the calendar (Reviewer = read full details)
Set-MailboxFolderPermission -Identity "car-toyota-camry-abc123:\Calendar" `
  -User Default `
  -AccessRights Reviewer

# Add to a room list (resource group) for the location
# First create the room list if it doesn't exist
New-DistributionGroup -Name "Bucharest Vehicles" -RoomList
Add-DistributionGroupMember -Identity "Bucharest Vehicles" `
  -Member "car-toyota-camry-abc123@contoso.com"
```

### HTML Event Body Template (Vehicle Resource Calendar)
```typescript
function buildVehicleEventBody(
  booking: IBooking,
  vehicle: IAvailableVehicle,
  appBaseUrl: string
): string {
  return `
    <div style="font-family: Segoe UI, sans-serif; font-size: 14px;">
      <h3>Vehicle Booking</h3>
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Employee:</td>
            <td>${escapeHtml(booking.userDisplayName || '')}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Email:</td>
            <td>${escapeHtml(booking.userEmail)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Booking ID:</td>
            <td>${booking.id}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Vehicle:</td>
            <td>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} (${escapeHtml(vehicle.licensePlate)})</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Category:</td>
            <td>${escapeHtml(vehicle.categoryName)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Location:</td>
            <td>${escapeHtml(vehicle.locationName)}</td></tr>
      </table>
      <p><a href="${appBaseUrl}/booking/${booking.id}">View in RentAVehicle</a></p>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exchange Web Services (EWS) | Microsoft Graph API | 2020+ (EWS deprecated) | Use Graph API exclusively; EWS is legacy |
| Application Access Policies (PowerShell) | RBAC for Applications (Exchange Online) | 2024 | Can scope `Calendars.ReadWrite` to specific mailboxes via RBAC instead of Application Access Policies (legacy). Either approach works. |
| `New-ApplicationAccessPolicy` | Exchange RBAC for Applications | 2024-2025 | New recommended way to limit application permissions to specific mailboxes |
| Graph API beta `/places` for mailbox creation | Exchange Online PowerShell | Ongoing | Beta places API has limited capabilities; PowerShell remains the only way to create equipment mailboxes |

**Deprecated/outdated:**
- **EWS (Exchange Web Services)**: Deprecated in favor of Microsoft Graph API. Do not use.
- **Application Access Policies**: Being replaced by RBAC for Applications in Exchange Online, but still functional. Either approach works for this phase.

## Open Questions

1. **Equipment Mailbox Licensing**
   - What we know: Exchange Online equipment mailboxes may or may not require a license depending on the M365 plan. In most E3/E5 plans, equipment mailboxes are free. STATE.md flags this as a known blocker: "Exchange equipment mailbox licensing must be confirmed before Phase 5."
   - What's unclear: Whether the specific tenant's plan includes free equipment mailboxes.
   - Recommendation: Verify with the tenant admin before implementation. If licensing is an issue, equipment mailboxes can share a single Exchange Online Plan 1 license.

2. **Mailbox Provisioning Automation**
   - What we know: Graph API cannot create equipment mailboxes. Exchange Online PowerShell (`New-Mailbox -Equipment`) is required.
   - What's unclear: Whether the Azure Functions app can invoke PowerShell cmdlets directly, or if provisioning should be a separate admin workflow.
   - Recommendation: Implement a two-tier approach: (1) Provide a PowerShell provisioning script that admins run manually or via Azure Automation. (2) The app's vehicle creation endpoint stores the resource mailbox email after an admin provisions it. Alternatively, use Azure Automation Runbooks to expose mailbox creation as an HTTP-triggered workflow callable from the app's admin API.

3. **App Registration Permissions**
   - What we know: The existing app registration has Graph API permissions for user queries (officeLocation sync). `Calendars.ReadWrite` application permission must be added.
   - What's unclear: Whether admin consent can be obtained without disrupting existing permissions.
   - Recommendation: Add `Calendars.ReadWrite` application permission to the existing app registration. Grant admin consent. This is additive and does not affect existing permissions.

4. **Deep Link URL Format**
   - What we know: The employee calendar event body should include a deep link back to the booking in the app.
   - What's unclear: The exact URL format for the SPFx webpart booking detail page.
   - Recommendation: Use a configurable base URL stored as an environment variable (e.g., `APP_BASE_URL`). The deep link format would be `{APP_BASE_URL}?bookingId={id}` or similar. The exact format depends on how the SPFx app handles routing (currently uses state-based navigation, not URL routing -- see Phase 3 decision).

5. **Room List (Distribution Group) for Vehicle Grouping**
   - What we know: Exchange uses "room lists" (distribution groups with `-RoomList` flag) to group resources by location. This enables the "Bucharest Vehicles" grouping in Outlook.
   - What's unclear: Whether room lists support equipment mailboxes (historically room-list is for rooms, not equipment). Equipment can be added to distribution groups but may not appear in the Outlook room finder.
   - Recommendation: Test with a single vehicle first. If room lists don't work for equipment, use custom Outlook categories or a shared calendar view as a fallback. The core requirement (browsable calendars) is met by granting Reviewer permissions regardless of grouping.

## Sources

### Primary (HIGH confidence)
- [Microsoft Graph API - Create event](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0) - Event creation HTTP methods, permissions, request body format
- [Microsoft Graph API - Update event](https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0) - PATCH event endpoints, updatable properties
- [Microsoft Graph API - Event resource type](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0) - Full property list including showAs, reminderMinutesBeforeStart
- [Microsoft Graph API - Calendar overview](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0) - Calendar API capabilities and permissions
- [Set-CalendarProcessing](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/set-calendarprocessing?view=exchange-ps) - BookInPolicy, AutomateProcessing parameters
- [Manage resource mailboxes](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-resource-mailboxes) - Equipment mailbox creation and configuration

### Secondary (MEDIUM confidence)
- [Application Access Policies (legacy)](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies) - Limiting Graph API access to specific mailboxes
- [RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac) - Modern replacement for application access policies
- [Calendars.ReadWrite permission details](https://graphpermissions.merill.net/permission/Calendars.ReadWrite) - Scope and limitations of calendar permissions
- [Room list resource type](https://learn.microsoft.com/en-us/graph/api/resources/roomlist?view=graph-rest-1.0) - Room list grouping for resources

### Tertiary (LOW confidence)
- [Creating calendar event with application permissions limitation](https://learn.microsoft.com/en-us/answers/questions/520835/creating-calendar-event-with-graph-api-application) - Community Q&A confirming app permissions don't send invitations (needs verification in test environment)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries, well-documented Graph API
- Architecture: MEDIUM-HIGH - Two-event pattern (not invitation) is verified in official docs; fire-and-forget is a sound pattern for projection layers
- Pitfalls: HIGH - Application permission invitation limitation is well-documented; equipment mailbox provisioning path is clear
- Mailbox provisioning: MEDIUM - PowerShell is the only path; automation options (Azure Automation Runbooks) need validation in the specific tenant

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable Graph API v1.0 endpoints, unlikely to change)
