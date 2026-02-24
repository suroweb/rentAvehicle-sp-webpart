/**
 * Calendar event CRUD operations via Microsoft Graph API.
 *
 * Creates and updates calendar events on both vehicle resource mailbox calendars
 * and employee personal Outlook calendars. All operations are fire-and-forget --
 * errors are logged but never thrown to callers.
 *
 * The app (Azure SQL) is the single system of record for bookings.
 * Outlook calendars are a read-only projection / display layer.
 */
import sql from 'mssql';
import { getGraphClient } from './graphService.js';
import { getPool } from './database.js';

/**
 * Input for creating or updating a calendar event via Graph API.
 */
interface CalendarEventInput {
  subject: string;
  bodyHtml: string;
  startDateTime: string; // ISO 8601 without trailing Z
  endDateTime: string;
  timeZone: string; // 'UTC'
  locationDisplayName: string;
  showAs: 'free' | 'busy';
  isReminderOn: boolean;
  reminderMinutesBeforeStart: number;
}

/**
 * Escape HTML special characters to prevent XSS in Outlook event bodies.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build HTML body for the vehicle resource calendar event.
 * Contains booking essentials: employee info, booking ID, times, vehicle details.
 */
function buildVehicleEventBody(
  booking: {
    id: number;
    userDisplayName: string | null;
    userEmail: string;
    startTime: string;
    endTime: string;
  },
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
    locationName: string;
    categoryName: string;
  },
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
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Pickup:</td>
        <td>${escapeHtml(booking.startTime)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Return:</td>
        <td>${escapeHtml(booking.endTime)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Vehicle:</td>
        <td>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} (${escapeHtml(vehicle.licensePlate)})</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Category:</td>
        <td>${escapeHtml(vehicle.categoryName)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Location:</td>
        <td>${escapeHtml(vehicle.locationName)}</td></tr>
  </table>
  <p><a href="${escapeHtml(appBaseUrl)}?bookingId=${booking.id}">View in RentAVehicle</a></p>
</div>`.trim();
}

/**
 * Build HTML body for the employee personal calendar event.
 * Pickup-focused: vehicle details, pickup location, return time, deep link.
 */
function buildEmployeeEventBody(
  booking: {
    id: number;
    startTime: string;
    endTime: string;
  },
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
    locationName: string;
  },
  appBaseUrl: string
): string {
  return `
<div style="font-family: Segoe UI, sans-serif; font-size: 14px;">
  <h3>Vehicle Rental</h3>
  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Vehicle:</td>
        <td>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} (${escapeHtml(vehicle.licensePlate)})</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Pickup Location:</td>
        <td>${escapeHtml(vehicle.locationName)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Pickup:</td>
        <td>${escapeHtml(booking.startTime)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Return:</td>
        <td>${escapeHtml(booking.endTime)}</td></tr>
  </table>
  <p><a href="${escapeHtml(appBaseUrl)}?bookingId=${booking.id}">View in RentAVehicle</a></p>
</div>`.trim();
}

/**
 * Prepend a status banner to an event body HTML string.
 * Used for CANCELLED, IN USE, and RETURNED status updates.
 */
function buildStatusUpdateBody(
  status: string,
  originalBody: string,
  reason?: string
): string {
  const reasonHtml = reason
    ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : '';
  const banner = `
<div style="background: #FFF4CE; border: 1px solid #FFB900; padding: 8px 12px; margin-bottom: 12px; font-family: Segoe UI, sans-serif; font-size: 14px;">
  <strong>[${escapeHtml(status)}]</strong>
  ${reasonHtml}
</div>`.trim();

  return banner + '\n' + originalBody;
}

/**
 * Create a calendar event on a user or resource mailbox calendar.
 * Returns the Graph API event ID on success, null on failure.
 * Errors are logged but never thrown.
 */
async function createCalendarEvent(
  userIdOrEmail: string,
  input: CalendarEventInput
): Promise<string | null> {
  try {
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
        reminderMinutesBeforeStart: input.reminderMinutesBeforeStart,
      });

    return event.id || null;
  } catch (error) {
    console.error(
      `Failed to create calendar event for ${userIdOrEmail}:`,
      error
    );
    return null;
  }
}

/**
 * Update an existing calendar event on a user or resource mailbox calendar.
 * Errors are logged but never thrown.
 */
async function updateCalendarEvent(
  userIdOrEmail: string,
  eventId: string,
  updates: Partial<CalendarEventInput>
): Promise<void> {
  try {
    const client = await getGraphClient();

    const patchBody: Record<string, unknown> = {};
    if (updates.subject) {
      patchBody.subject = updates.subject;
    }
    if (updates.bodyHtml) {
      patchBody.body = { contentType: 'HTML', content: updates.bodyHtml };
    }
    if (updates.startDateTime) {
      patchBody.start = {
        dateTime: updates.startDateTime,
        timeZone: updates.timeZone || 'UTC',
      };
    }
    if (updates.endDateTime) {
      patchBody.end = {
        dateTime: updates.endDateTime,
        timeZone: updates.timeZone || 'UTC',
      };
    }

    await client
      .api(`/users/${userIdOrEmail}/events/${eventId}`)
      .patch(patchBody);
  } catch (error) {
    console.error(
      `Failed to update calendar event ${eventId} for ${userIdOrEmail}:`,
      error
    );
  }
}

/**
 * Strip trailing 'Z' from ISO datetime strings for Graph API.
 * Graph API expects datetime without Z suffix when timeZone is specified.
 */
function stripTrailingZ(isoString: string): string {
  return isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
}

/**
 * Main orchestrator: sync a booking action to both vehicle and employee calendars.
 *
 * Called fire-and-forget from booking endpoints. All errors are caught and logged
 * internally -- this function never throws.
 *
 * Actions:
 * - 'created': Create events on vehicle resource calendar + employee personal calendar
 * - 'cancelled': Prepend [CANCELLED] to subject, add cancellation banner to body
 * - 'checked_out': Prepend [IN USE] to subject, add check-out banner to body
 * - 'checked_in': Prepend [RETURNED] to subject, add return banner to body
 * - 'time_modified': Update start/end times and regenerate event body (future-wiring hook)
 */
export async function syncBookingToCalendars(
  bookingId: number,
  action: 'created' | 'cancelled' | 'checked_out' | 'checked_in' | 'time_modified',
  cancelReason?: string
): Promise<void> {
  try {
    const pool = await getPool();
    const appBaseUrl = process.env.APP_BASE_URL || '';

    if (action === 'created') {
      // Query booking with vehicle and location details for event creation
      const result = await pool.request()
        .input('bookingId', sql.Int, bookingId)
        .query(`
          SELECT
            b.id, b.userId, b.userEmail, b.userDisplayName,
            b.startTime, b.endTime,
            v.make, v.model, v.licensePlate, v.resourceMailboxEmail,
            l.name AS locationName,
            c.name AS categoryName
          FROM Bookings b
          INNER JOIN Vehicles v ON b.vehicleId = v.id
          LEFT JOIN Locations l ON v.locationId = l.id
          LEFT JOIN Categories c ON v.categoryId = c.id
          WHERE b.id = @bookingId
        `);

      if (result.recordset.length === 0) {
        console.error(`Calendar sync: booking ${bookingId} not found`);
        return;
      }

      const row = result.recordset[0];
      const startDt = stripTrailingZ(new Date(row.startTime).toISOString());
      const endDt = stripTrailingZ(new Date(row.endTime).toISOString());

      const booking = {
        id: row.id,
        userDisplayName: row.userDisplayName,
        userEmail: row.userEmail,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      };
      const vehicle = {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        locationName: row.locationName || '',
        categoryName: row.categoryName || '',
      };

      let vehicleEventId: string | null = null;
      let employeeEventId: string | null = null;

      // Create vehicle resource calendar event (skip if no mailbox provisioned)
      if (row.resourceMailboxEmail) {
        vehicleEventId = await createCalendarEvent(row.resourceMailboxEmail, {
          subject: `${row.userDisplayName || row.userEmail} - ${row.make} ${row.model} (${row.licensePlate})`,
          bodyHtml: buildVehicleEventBody(booking, vehicle, appBaseUrl),
          startDateTime: startDt,
          endDateTime: endDt,
          timeZone: 'UTC',
          locationDisplayName: row.locationName || '',
          showAs: 'busy',
          isReminderOn: false,
          reminderMinutesBeforeStart: 0,
        });
      }

      // Create employee personal calendar event
      employeeEventId = await createCalendarEvent(row.userEmail, {
        subject: `Vehicle Rental: ${row.make} ${row.model} (${row.licensePlate})`,
        bodyHtml: buildEmployeeEventBody(booking, vehicle, appBaseUrl),
        startDateTime: startDt,
        endDateTime: endDt,
        timeZone: 'UTC',
        locationDisplayName: row.locationName || '',
        showAs: 'free',
        isReminderOn: true,
        reminderMinutesBeforeStart: 30,
      });

      // Store event IDs in the database for later updates
      if (vehicleEventId || employeeEventId) {
        await pool.request()
          .input('bookingId', sql.Int, bookingId)
          .input('vehicleCalendarEventId', sql.NVarChar(255), vehicleEventId)
          .input('employeeCalendarEventId', sql.NVarChar(255), employeeEventId)
          .query(`
            UPDATE Bookings
            SET vehicleCalendarEventId = @vehicleCalendarEventId,
                employeeCalendarEventId = @employeeCalendarEventId
            WHERE id = @bookingId
          `);
      }

      return;
    }

    // For update actions (cancelled, checked_out, checked_in, time_modified),
    // query booking with event IDs and vehicle details
    const result = await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT
          b.id, b.userId, b.userEmail, b.userDisplayName,
          b.startTime, b.endTime,
          b.vehicleCalendarEventId, b.employeeCalendarEventId,
          v.make, v.model, v.licensePlate, v.resourceMailboxEmail,
          l.name AS locationName,
          c.name AS categoryName
        FROM Bookings b
        INNER JOIN Vehicles v ON b.vehicleId = v.id
        LEFT JOIN Locations l ON v.locationId = l.id
        LEFT JOIN Categories c ON v.categoryId = c.id
        WHERE b.id = @bookingId
      `);

    if (result.recordset.length === 0) {
      console.error(`Calendar sync: booking ${bookingId} not found`);
      return;
    }

    const row = result.recordset[0];
    const vehicleEventId: string | null = row.vehicleCalendarEventId;
    const employeeEventId: string | null = row.employeeCalendarEventId;
    const resourceMailbox: string | null = row.resourceMailboxEmail;

    if (action === 'cancelled') {
      const vehicleSubject = `[CANCELLED] ${row.userDisplayName || row.userEmail} - ${row.make} ${row.model} (${row.licensePlate})`;
      const employeeSubject = `[CANCELLED] Vehicle Rental: ${row.make} ${row.model} (${row.licensePlate})`;

      const booking = {
        id: row.id,
        userDisplayName: row.userDisplayName,
        userEmail: row.userEmail,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      };
      const vehicle = {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        locationName: row.locationName || '',
        categoryName: row.categoryName || '',
      };

      if (vehicleEventId && resourceMailbox) {
        const vehicleBody = buildVehicleEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(resourceMailbox, vehicleEventId, {
          subject: vehicleSubject,
          bodyHtml: buildStatusUpdateBody('CANCELLED', vehicleBody, cancelReason),
        });
      }

      if (employeeEventId) {
        const employeeBody = buildEmployeeEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(row.userEmail, employeeEventId, {
          subject: employeeSubject,
          bodyHtml: buildStatusUpdateBody('CANCELLED', employeeBody, cancelReason),
        });
      }

      return;
    }

    if (action === 'checked_out') {
      const vehicleSubject = `[IN USE] ${row.userDisplayName || row.userEmail} - ${row.make} ${row.model} (${row.licensePlate})`;
      const employeeSubject = `[IN USE] Vehicle Rental: ${row.make} ${row.model} (${row.licensePlate})`;

      const booking = {
        id: row.id,
        userDisplayName: row.userDisplayName,
        userEmail: row.userEmail,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      };
      const vehicle = {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        locationName: row.locationName || '',
        categoryName: row.categoryName || '',
      };

      if (vehicleEventId && resourceMailbox) {
        const vehicleBody = buildVehicleEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(resourceMailbox, vehicleEventId, {
          subject: vehicleSubject,
          bodyHtml: buildStatusUpdateBody('IN USE', vehicleBody),
        });
      }

      if (employeeEventId) {
        const employeeBody = buildEmployeeEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(row.userEmail, employeeEventId, {
          subject: employeeSubject,
          bodyHtml: buildStatusUpdateBody('IN USE', employeeBody),
        });
      }

      return;
    }

    if (action === 'checked_in') {
      const vehicleSubject = `[RETURNED] ${row.userDisplayName || row.userEmail} - ${row.make} ${row.model} (${row.licensePlate})`;
      const employeeSubject = `[RETURNED] Vehicle Rental: ${row.make} ${row.model} (${row.licensePlate})`;

      const booking = {
        id: row.id,
        userDisplayName: row.userDisplayName,
        userEmail: row.userEmail,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      };
      const vehicle = {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        locationName: row.locationName || '',
        categoryName: row.categoryName || '',
      };

      if (vehicleEventId && resourceMailbox) {
        const vehicleBody = buildVehicleEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(resourceMailbox, vehicleEventId, {
          subject: vehicleSubject,
          bodyHtml: buildStatusUpdateBody('RETURNED', vehicleBody),
        });
      }

      if (employeeEventId) {
        const employeeBody = buildEmployeeEventBody(booking, vehicle, appBaseUrl);
        await updateCalendarEvent(row.userEmail, employeeEventId, {
          subject: employeeSubject,
          bodyHtml: buildStatusUpdateBody('RETURNED', employeeBody),
        });
      }

      return;
    }

    if (action === 'time_modified') {
      // Future-wiring hook: No endpoint currently supports modifying booking start/end times.
      // When a booking time modification endpoint is added in a future phase,
      // call syncBookingToCalendars(bookingId, 'time_modified') after the DB update.
      // This action PATCHes both events with new start/end times and regenerated body content.
      const startDt = stripTrailingZ(new Date(row.startTime).toISOString());
      const endDt = stripTrailingZ(new Date(row.endTime).toISOString());

      const booking = {
        id: row.id,
        userDisplayName: row.userDisplayName,
        userEmail: row.userEmail,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      };
      const vehicle = {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        locationName: row.locationName || '',
        categoryName: row.categoryName || '',
      };

      if (vehicleEventId && resourceMailbox) {
        await updateCalendarEvent(resourceMailbox, vehicleEventId, {
          subject: `${row.userDisplayName || row.userEmail} - ${row.make} ${row.model} (${row.licensePlate})`,
          bodyHtml: buildVehicleEventBody(booking, vehicle, appBaseUrl),
          startDateTime: startDt,
          endDateTime: endDt,
          timeZone: 'UTC',
        });
      }

      if (employeeEventId) {
        await updateCalendarEvent(row.userEmail, employeeEventId, {
          subject: `Vehicle Rental: ${row.make} ${row.model} (${row.licensePlate})`,
          bodyHtml: buildEmployeeEventBody(booking, vehicle, appBaseUrl),
          startDateTime: startDt,
          endDateTime: endDt,
          timeZone: 'UTC',
        });
      }

      return;
    }
  } catch (error) {
    console.error(
      `Calendar sync failed for booking ${bookingId} (action: ${action}):`,
      error
    );
  }
}
