/**
 * Preview text builders for Teams activity feed notifications.
 *
 * These are NOT full Adaptive Card JSON -- they are formatted preview strings
 * displayed in the Teams activity feed. Teams activity feed notifications via
 * Graph API use text-based preview content with deep links to the webpart.
 */

/**
 * Format a date string into a short human-readable format for activity feed preview.
 * Example: "Feb 26, 10:00 AM"
 */
function formatShort(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Build preview text for a booking confirmation activity feed notification.
 * Example: "Booking confirmed: Toyota Camry, Feb 26 10:00 AM - Feb 26 6:00 PM"
 */
export function buildBookingConfirmationPreview(
  vehicleName: string,
  startDate: string,
  endDate: string
): string {
  return `Booking confirmed: ${vehicleName}, ${formatShort(startDate)} - ${formatShort(endDate)}`;
}

/**
 * Build preview text for a manager booking alert activity feed notification.
 * Example: "John Smith booked Toyota Camry, Feb 26 10:00 AM - Feb 26 6:00 PM"
 */
export function buildManagerAlertPreview(
  employeeName: string,
  vehicleName: string,
  startDate: string,
  endDate: string
): string {
  return `${employeeName} booked ${vehicleName}, ${formatShort(startDate)} - ${formatShort(endDate)}`;
}

/**
 * Build preview text for pickup or return reminder activity feed notifications.
 * Pickup example: "Pickup reminder: Toyota Camry at 10:00 AM"
 * Return example: "Return reminder: Toyota Camry due at 6:00 PM"
 */
export function buildReminderPreview(
  type: 'pickup' | 'return',
  vehicleName: string,
  time: string
): string {
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(time));

  if (type === 'pickup') {
    return `Pickup reminder: ${vehicleName} at ${timeFormatted}`;
  }
  return `Return reminder: ${vehicleName} due at ${timeFormatted}`;
}

/**
 * Build preview text for overdue booking activity feed notifications.
 * Example: "Overdue: Toyota Camry was due at 6:00 PM"
 */
export function buildOverduePreview(
  vehicleName: string,
  returnTime: string
): string {
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(returnTime));

  return `Overdue: ${vehicleName} was due at ${timeFormatted}`;
}
