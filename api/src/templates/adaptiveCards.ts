/**
 * Preview text builders for Teams activity feed notifications.
 *
 * These are NOT full Adaptive Card JSON -- they are formatted preview strings
 * displayed in the Teams activity feed. Teams activity feed notifications via
 * Graph API use text-based preview content with deep links to the webpart.
 */

/**
 * Format a date string into a short human-readable format for activity feed preview.
 * Appends timezone abbreviation for clarity.
 * Example: "Feb 26, 10:00 AM EET"
 */
function formatShort(dateStr: string, timezone: string): string {
  const date = new Date(dateStr);
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date);
  const abbr = extractTimezoneAbbr(timezone, date);
  return formatted + ' ' + abbr;
}

/**
 * Extract timezone abbreviation (e.g. 'EET', 'CET', 'GMT+2') for a given date.
 */
function extractTimezoneAbbr(timezone: string, date: Date): string {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const formatted = f.format(date);
    const commaIndex = formatted.lastIndexOf(', ');
    if (commaIndex >= 0) {
      return formatted.substring(commaIndex + 2);
    }
    return timezone;
  } catch {
    return timezone;
  }
}

/**
 * Build preview text for a booking confirmation activity feed notification.
 * Example: "Booking confirmed: Toyota Camry, Feb 26 10:00 AM EET - Feb 26 6:00 PM EET"
 */
export function buildBookingConfirmationPreview(
  vehicleName: string,
  startDate: string,
  endDate: string,
  timezone: string
): string {
  return `Booking confirmed: ${vehicleName}, ${formatShort(startDate, timezone)} - ${formatShort(endDate, timezone)}`;
}

/**
 * Build preview text for a manager booking alert activity feed notification.
 * Example: "John Smith booked Toyota Camry, Feb 26 10:00 AM EET - Feb 26 6:00 PM EET"
 */
export function buildManagerAlertPreview(
  employeeName: string,
  vehicleName: string,
  startDate: string,
  endDate: string,
  timezone: string
): string {
  return `${employeeName} booked ${vehicleName}, ${formatShort(startDate, timezone)} - ${formatShort(endDate, timezone)}`;
}

/**
 * Build preview text for pickup or return reminder activity feed notifications.
 * Pickup example: "Pickup reminder: Toyota Camry at 10:00 AM EET"
 * Return example: "Return reminder: Toyota Camry due at 6:00 PM EET"
 */
export function buildReminderPreview(
  type: 'pickup' | 'return',
  vehicleName: string,
  time: string,
  timezone: string
): string {
  const date = new Date(time);
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date);
  const abbr = extractTimezoneAbbr(timezone, date);

  if (type === 'pickup') {
    return `Pickup reminder: ${vehicleName} at ${timeFormatted} ${abbr}`;
  }
  return `Return reminder: ${vehicleName} due at ${timeFormatted} ${abbr}`;
}

/**
 * Build preview text for overdue booking activity feed notifications.
 * Example: "Overdue: Toyota Camry was due at 6:00 PM EET"
 */
export function buildOverduePreview(
  vehicleName: string,
  returnTime: string,
  timezone: string
): string {
  const date = new Date(returnTime);
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date);
  const abbr = extractTimezoneAbbr(timezone, date);

  return `Overdue: ${vehicleName} was due at ${timeFormatted} ${abbr}`;
}
