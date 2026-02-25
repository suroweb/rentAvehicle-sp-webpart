/**
 * Timer-triggered Azure Function for scheduled notification processing.
 *
 * Runs every 5 minutes to check for and send:
 * - Pickup reminders (1 hour before start time)
 * - Return reminders (1 hour before return time)
 * - Overdue notifications (15 minutes after return time passes)
 *
 * Each reminder type tracks its sent state in the database to prevent
 * duplicate notifications across multiple function instances.
 */
import { app, Timer, InvocationContext } from '@azure/functions';
import {
  processPickupReminders,
  processReturnReminders,
  processOverdueNotifications,
} from '../services/notificationService.js';

async function notificationTimer(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  if (timer.isPastDue) {
    context.log('Notification timer is past due -- processing missed notifications');
  }

  const startTime = Date.now();

  try {
    const [pickupCount, returnCount, overdueCount] = await Promise.all([
      processPickupReminders(context),
      processReturnReminders(context),
      processOverdueNotifications(context),
    ]);

    const elapsed = Date.now() - startTime;
    context.log(
      `Notification timer complete: ${pickupCount} pickup, ${returnCount} return, ${overdueCount} overdue reminders sent (${elapsed}ms)`
    );
  } catch (error) {
    context.error('Notification timer failed:', error);
  }
}

app.timer('notificationTimer', {
  schedule: '0 */5 * * * *', // Every 5 minutes (6-field NCRONTAB)
  handler: notificationTimer,
});
