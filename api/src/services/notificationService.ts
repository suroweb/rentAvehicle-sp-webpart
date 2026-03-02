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
  buildReminderPreview,
  buildOverduePreview,
} from '../templates/adaptiveCards.js';
import type { InvocationContext } from '@azure/functions';

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
          l.timezone AS locationTimezone,
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
    const locationTimezone = row.locationTimezone || 'UTC';

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
      appBaseUrl,
      locationTimezone
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
  bookingId: number,
  vehicleName?: string
): Promise<void> {
  try {
    // Deep link to the RentAVehicle personal tab in Teams
    // TEAMS_APP_ID must match the "id" field in spfx/teams/manifest.json
    const teamsAppId = process.env.TEAMS_APP_ID;
    const entityId = 'rentavehicle';
    const webUrl = teamsAppId
      ? `https://teams.microsoft.com/l/entity/${teamsAppId}/${entityId}?context=${encodeURIComponent(JSON.stringify({ subEntityId: 'myBookings' }))}`
      : `https://teams.microsoft.com`;

    const client = await getGraphClient();
    await client
      .api(`/users/${userId}/teamwork/sendActivityNotification`)
      .post({
        topic: {
          source: 'text',
          value: 'RentAVehicle',
          webUrl,
        },
        activityType,
        previewText: {
          content: previewText,
        },
        templateParameters: vehicleName
          ? [{ name: 'vehicle', value: vehicleName }]
          : [],
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
  endDate: string,
  timezone: string
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
      endDate,
      timezone
    );

    await sendTeamsActivityNotification(
      manager.id,
      'managerBookingAlert',
      previewText,
      bookingId,
      vehicleName
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
          l.timezone AS locationTimezone,
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
    const locationTimezone = row.locationTimezone || 'UTC';

    const confirmPreview = buildBookingConfirmationPreview(
      vehicleName,
      startIso,
      endIso,
      locationTimezone
    );

    const results = await Promise.allSettled([
      // 1. Email confirmation to employee
      sendBookingConfirmationEmail(bookingId),
      // 2. Teams activity notification to employee
      sendTeamsActivityNotification(
        row.userId,
        'bookingConfirmed',
        confirmPreview,
        bookingId,
        vehicleName
      ),
      // 3. Teams activity notification to manager
      notifyManagerOfBooking(
        bookingId,
        row.userId,
        row.userDisplayName || row.userEmail,
        vehicleName,
        startIso,
        endIso,
        locationTimezone
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

// ---------------------------------------------------------------------------
// Scheduled reminder processing (called from timer-triggered Azure Function)
// ---------------------------------------------------------------------------

/**
 * Process items in batches with a delay between batches to avoid Graph API rate limiting.
 * Same pattern as Phase 5 calendar backfill.
 */
async function processBatch<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(processor));
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Process pickup reminders for bookings starting within the next hour.
 *
 * Queries confirmed bookings where startTime is between NOW and NOW + 1 hour
 * and pickupReminderSentAt is NULL. Sends Teams activity feed notification
 * to each employee, then atomically marks the reminder as sent.
 *
 * @returns Count of reminders sent
 */
export async function processPickupReminders(
  context?: InvocationContext
): Promise<number> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.id, b.userId, b.userEmail, b.userDisplayName,
        b.startTime, b.endTime,
        v.make, v.model, v.licensePlate,
        l.name AS locationName,
        l.timezone AS locationTimezone
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE b.status = 'Confirmed'
        AND b.startTime > GETUTCDATE()
        AND b.startTime <= DATEADD(HOUR, 1, GETUTCDATE())
        AND b.pickupReminderSentAt IS NULL
    `);

    if (result.recordset.length === 0) {
      return 0;
    }

    let sentCount = 0;

    await processBatch(result.recordset, 10, 1000, async (row) => {
      try {
        const locationTimezone = row.locationTimezone || 'UTC';
        const vehicleName = `${row.make} ${row.model}`;
        const previewText = buildReminderPreview(
          'pickup',
          vehicleName,
          new Date(row.startTime).toISOString(),
          locationTimezone
        );

        await sendTeamsActivityNotification(
          row.userId,
          'pickupReminder',
          previewText,
          row.id,
          vehicleName
        );

        // Atomic update -- WHERE sentAt IS NULL prevents duplicates across instances
        await pool
          .request()
          .input('bookingId', sql.Int, row.id)
          .query(`
            UPDATE Bookings
            SET pickupReminderSentAt = GETUTCDATE()
            WHERE id = @bookingId AND pickupReminderSentAt IS NULL
          `);

        sentCount++;
      } catch (error) {
        (context || console).error(
          `Pickup reminder failed for booking ${row.id}:`,
          error
        );
      }
    });

    return sentCount;
  } catch (error) {
    (context || console).error('processPickupReminders failed:', error);
    return 0;
  }
}

/**
 * Process return reminders for bookings with return time within the next hour.
 *
 * Queries active or confirmed bookings where endTime is between NOW and NOW + 1 hour
 * and returnReminderSentAt is NULL. Sends Teams activity feed notification
 * to each employee, then atomically marks the reminder as sent.
 *
 * @returns Count of reminders sent
 */
export async function processReturnReminders(
  context?: InvocationContext
): Promise<number> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.id, b.userId, b.userEmail, b.userDisplayName,
        b.startTime, b.endTime,
        v.make, v.model, v.licensePlate,
        l.name AS locationName,
        l.timezone AS locationTimezone
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE b.status IN ('Active', 'Confirmed')
        AND b.endTime > GETUTCDATE()
        AND b.endTime <= DATEADD(HOUR, 1, GETUTCDATE())
        AND b.returnReminderSentAt IS NULL
    `);

    if (result.recordset.length === 0) {
      return 0;
    }

    let sentCount = 0;

    await processBatch(result.recordset, 10, 1000, async (row) => {
      try {
        const locationTimezone = row.locationTimezone || 'UTC';
        const vehicleName = `${row.make} ${row.model}`;
        const previewText = buildReminderPreview(
          'return',
          vehicleName,
          new Date(row.endTime).toISOString(),
          locationTimezone
        );

        await sendTeamsActivityNotification(
          row.userId,
          'returnReminder',
          previewText,
          row.id,
          vehicleName
        );

        // Atomic update -- WHERE sentAt IS NULL prevents duplicates across instances
        await pool
          .request()
          .input('bookingId', sql.Int, row.id)
          .query(`
            UPDATE Bookings
            SET returnReminderSentAt = GETUTCDATE()
            WHERE id = @bookingId AND returnReminderSentAt IS NULL
          `);

        sentCount++;
      } catch (error) {
        (context || console).error(
          `Return reminder failed for booking ${row.id}:`,
          error
        );
      }
    });

    return sentCount;
  } catch (error) {
    (context || console).error('processReturnReminders failed:', error);
    return 0;
  }
}

/**
 * Process overdue notifications for bookings past their return time + 15 min grace period.
 *
 * Queries bookings where status is 'Overdue' or status is 'Active' with endTime + 15 min
 * past current time, and overdueNotificationSentAt is NULL. For Active bookings that meet
 * the overdue condition, first transitions them to Overdue status. Then sends Teams
 * activity feed notifications to the employee, their manager, and optionally the admin.
 *
 * @returns Count of overdue notifications sent
 */
export async function processOverdueNotifications(
  context?: InvocationContext
): Promise<number> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.id, b.userId, b.userEmail, b.userDisplayName,
        b.startTime, b.endTime, b.status,
        v.make, v.model, v.licensePlate,
        l.name AS locationName,
        l.timezone AS locationTimezone
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE b.overdueNotificationSentAt IS NULL
        AND (
          b.status = 'Overdue'
          OR (b.status = 'Active' AND b.endTime < DATEADD(MINUTE, -15, GETUTCDATE()))
        )
    `);

    if (result.recordset.length === 0) {
      return 0;
    }

    let sentCount = 0;

    await processBatch(result.recordset, 10, 1000, async (row) => {
      try {
        // If status is Active and past grace period, transition to Overdue
        if (row.status === 'Active') {
          await pool
            .request()
            .input('bookingId', sql.Int, row.id)
            .query(`
              UPDATE Bookings
              SET status = 'Overdue', updatedAt = GETUTCDATE()
              WHERE id = @bookingId AND status = 'Active'
                AND endTime < DATEADD(MINUTE, -15, GETUTCDATE())
            `);
        }

        const locationTimezone = row.locationTimezone || 'UTC';
        const vehicleName = `${row.make} ${row.model}`;
        const previewText = buildOverduePreview(
          vehicleName,
          new Date(row.endTime).toISOString(),
          locationTimezone
        );

        // 1. Notify employee
        await sendTeamsActivityNotification(
          row.userId,
          'bookingOverdue',
          previewText,
          row.id,
          vehicleName
        );

        // 2. Notify manager (if exists)
        const manager = await getManagerInfo(row.userId);
        if (manager) {
          await sendTeamsActivityNotification(
            manager.id,
            'bookingOverdue',
            previewText,
            row.id,
            vehicleName
          );
        }

        // 3. Notify admin (if OVERDUE_ADMIN_EMAIL configured)
        const adminEmail = process.env.OVERDUE_ADMIN_EMAIL;
        if (adminEmail) {
          try {
            const client = await getGraphClient();
            const adminUser = await client
              .api(`/users/${adminEmail}`)
              .select('id')
              .get();
            if (adminUser && adminUser.id) {
              await sendTeamsActivityNotification(
                adminUser.id,
                'bookingOverdue',
                previewText,
                row.id,
                vehicleName
              );
            }
          } catch (adminError) {
            (context || console).error(
              `Failed to notify admin for overdue booking ${row.id}:`,
              adminError
            );
          }
        }

        // Atomic update -- WHERE sentAt IS NULL prevents duplicates across instances
        await pool
          .request()
          .input('bookingId', sql.Int, row.id)
          .query(`
            UPDATE Bookings
            SET overdueNotificationSentAt = GETUTCDATE()
            WHERE id = @bookingId AND overdueNotificationSentAt IS NULL
          `);

        sentCount++;
      } catch (error) {
        (context || console).error(
          `Overdue notification failed for booking ${row.id}:`,
          error
        );
      }
    });

    return sentCount;
  } catch (error) {
    (context || console).error('processOverdueNotifications failed:', error);
    return 0;
  }
}
