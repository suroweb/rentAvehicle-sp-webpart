/**
 * Notification service for RentAVehicle.
 *
 * Provides email confirmations (Graph sendMail), Teams activity feed notifications,
 * and manager lookup via Microsoft Graph API. All functions follow the fire-and-forget
 * pattern -- errors are logged but never thrown to callers.
 *
 * Graph API permissions required:
 * - Mail.Send (application) -- for sending confirmation emails
 * - TeamsActivity.Send.User (application) -- for Teams activity feed notifications
 * - User.Read.All (application) -- for manager lookup (already granted from Phase 2)
 */
import sql from 'mssql';
import { getGraphClient } from './graphService.js';
import { getPool } from './database.js';
import { buildConfirmationEmailHtml } from '../templates/emailConfirmation.js';
import {
  buildBookingConfirmationPreview,
  buildManagerAlertPreview,
} from '../templates/adaptiveCards.js';

/**
 * Look up a user's manager via Microsoft Graph API.
 * Returns manager info if found, null if no manager or on any error.
 */
export async function getManagerInfo(
  userId: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  try {
    const client = await getGraphClient();
    const manager = await client
      .api(`/users/${userId}/manager`)
      .select('id,mail,displayName')
      .get();

    if (!manager || !manager.id) {
      return null;
    }

    return {
      id: manager.id,
      email: manager.mail || '',
      displayName: manager.displayName || '',
    };
  } catch (error: unknown) {
    // 404 = user has no manager assigned -- not an error condition
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode !== 404) {
      console.error(`Failed to get manager for user ${userId}:`, error);
    }
    return null;
  }
}

/**
 * Send a booking confirmation email via Microsoft Graph sendMail API.
 *
 * Queries the booking with vehicle/location joins, builds an HTML email,
 * and sends via the configured sender mailbox. Fire-and-forget -- all errors
 * are logged but never thrown.
 */
export async function sendBookingConfirmationEmail(
  bookingId: number
): Promise<void> {
  try {
    const senderEmail = process.env.NOTIFICATION_SENDER_EMAIL;
    if (!senderEmail) {
      console.error(
        'NOTIFICATION_SENDER_EMAIL not configured -- skipping email for booking',
        bookingId
      );
      return;
    }

    const appBaseUrl = process.env.APP_BASE_URL || '';

    const pool = await getPool();
    const result = await pool
      .request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT
          b.id, b.userId, b.userEmail, b.userDisplayName,
          b.startTime, b.endTime,
          v.make, v.model, v.licensePlate,
          l.name AS locationName,
          c.name AS categoryName
        FROM Bookings b
        INNER JOIN Vehicles v ON b.vehicleId = v.id
        LEFT JOIN Locations l ON v.locationId = l.id
        LEFT JOIN Categories c ON v.categoryId = c.id
        WHERE b.id = @bookingId
      `);

    if (result.recordset.length === 0) {
      console.error(`Notification: booking ${bookingId} not found`);
      return;
    }

    const row = result.recordset[0];

    const htmlBody = buildConfirmationEmailHtml(
      {
        id: row.id,
        startTime: new Date(row.startTime).toISOString(),
        endTime: new Date(row.endTime).toISOString(),
      },
      {
        make: row.make,
        model: row.model,
        licensePlate: row.licensePlate,
        categoryName: row.categoryName || '',
        locationName: row.locationName || '',
      },
      appBaseUrl
    );

    const subject = `Booking Confirmed: ${row.make} ${row.model} (${row.licensePlate}) - ${row.locationName || 'Unknown Location'}`;

    const client = await getGraphClient();
    await client.api(`/users/${senderEmail}/sendMail`).post({
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: row.userEmail,
            },
          },
        ],
      },
      saveToSentItems: false,
    });

    console.log(
      `Booking confirmation email sent for booking ${bookingId} to ${row.userEmail}`
    );
  } catch (error) {
    console.error(
      `Failed to send confirmation email for booking ${bookingId}:`,
      error
    );
  }
}

/**
 * Send a Teams activity feed notification to a user via Microsoft Graph API.
 *
 * Uses the /users/{userId}/teamwork/sendActivityNotification endpoint.
 * The notification appears in the user's Teams activity feed with a deep link
 * back to the webpart. Fire-and-forget -- errors are logged but never thrown.
 *
 * @param userId - Entra ID object ID of the recipient
 * @param activityType - Notification type identifier (e.g., 'bookingConfirmed', 'pickupReminder')
 * @param previewText - Text shown in the activity feed
 * @param bookingId - Booking ID for deep link construction
 */
export async function sendTeamsActivityNotification(
  userId: string,
  activityType: string,
  previewText: string,
  bookingId: number
): Promise<void> {
  try {
    const appBaseUrl = process.env.APP_BASE_URL || '';

    const client = await getGraphClient();
    await client
      .api(`/users/${userId}/teamwork/sendActivityNotification`)
      .post({
        topic: {
          source: 'text',
          value: 'RentAVehicle',
          webUrl: `${appBaseUrl}?bookingId=${bookingId}`,
        },
        activityType,
        previewText: {
          content: previewText,
        },
        templateParameters: [],
      });

    console.log(
      `Teams activity notification sent to ${userId}: ${activityType} for booking ${bookingId}`
    );
  } catch (error) {
    // Teams activity feed may fail if the Teams app is not installed for the user -- that's OK
    console.error(
      `Failed to send Teams activity notification to ${userId} for booking ${bookingId}:`,
      error
    );
  }
}

/**
 * Notify a user's manager about a new booking via Teams activity feed.
 *
 * Looks up the manager via Graph API. If the user has a manager, sends a
 * Teams activity feed notification with booking details. Fire-and-forget.
 */
export async function notifyManagerOfBooking(
  bookingId: number,
  employeeUserId: string,
  employeeName: string,
  vehicleName: string,
  startDate: string,
  endDate: string
): Promise<void> {
  try {
    const manager = await getManagerInfo(employeeUserId);
    if (!manager) {
      return; // No manager -- silently skip
    }

    const previewText = buildManagerAlertPreview(
      employeeName,
      vehicleName,
      startDate,
      endDate
    );

    await sendTeamsActivityNotification(
      manager.id,
      'managerBookingAlert',
      previewText,
      bookingId
    );
  } catch (error) {
    console.error(
      `Failed to notify manager for booking ${bookingId}:`,
      error
    );
  }
}

/**
 * Main notification orchestrator for new bookings.
 *
 * Called fire-and-forget from the createBookingEndpoint. Queries booking details
 * once, then dispatches all notifications in parallel:
 * 1. Email confirmation to the employee
 * 2. Teams activity feed notification to the employee
 * 3. Teams activity feed notification to the employee's manager
 *
 * Uses Promise.allSettled so one failure doesn't block others.
 */
export async function sendBookingNotifications(
  bookingId: number
): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT
          b.id, b.userId, b.userEmail, b.userDisplayName,
          b.startTime, b.endTime,
          v.make, v.model, v.licensePlate,
          l.name AS locationName,
          c.name AS categoryName
        FROM Bookings b
        INNER JOIN Vehicles v ON b.vehicleId = v.id
        LEFT JOIN Locations l ON v.locationId = l.id
        LEFT JOIN Categories c ON v.categoryId = c.id
        WHERE b.id = @bookingId
      `);

    if (result.recordset.length === 0) {
      console.error(
        `sendBookingNotifications: booking ${bookingId} not found`
      );
      return;
    }

    const row = result.recordset[0];
    const vehicleName = `${row.make} ${row.model}`;
    const startIso = new Date(row.startTime).toISOString();
    const endIso = new Date(row.endTime).toISOString();

    const confirmPreview = buildBookingConfirmationPreview(
      vehicleName,
      startIso,
      endIso
    );

    const results = await Promise.allSettled([
      // 1. Email confirmation to employee
      sendBookingConfirmationEmail(bookingId),
      // 2. Teams activity notification to employee
      sendTeamsActivityNotification(
        row.userId,
        'bookingConfirmed',
        confirmPreview,
        bookingId
      ),
      // 3. Teams activity notification to manager
      notifyManagerOfBooking(
        bookingId,
        row.userId,
        row.userDisplayName || row.userEmail,
        vehicleName,
        startIso,
        endIso
      ),
    ]);

    // Log any rejected promises for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const labels = ['email', 'teams-employee', 'teams-manager'];
        console.error(
          `sendBookingNotifications: ${labels[i]} failed for booking ${bookingId}:`,
          r.reason
        );
      }
    });
  } catch (error) {
    console.error(
      `sendBookingNotifications failed for booking ${bookingId}:`,
      error
    );
  }
}
