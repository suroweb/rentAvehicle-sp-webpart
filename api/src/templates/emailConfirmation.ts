/**
 * HTML email template for booking confirmation emails.
 *
 * Generates a professional HTML email with booking details, vehicle info,
 * and styled action buttons (View Booking, Cancel Booking) that deep-link
 * back to the RentAVehicle webpart.
 */

/**
 * Escape HTML special characters to prevent XSS in email content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format a date string into a human-readable format for email display.
 * Example: "Feb 26, 2026, 10:00 AM"
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Build the HTML email body for a booking confirmation email.
 *
 * Includes:
 * - Booking details table (ID, vehicle, category, location, dates, status)
 * - Styled action buttons ("View Booking" and "Cancel Booking" deep links)
 * - Footer with automated message disclaimer
 *
 * @param booking - Booking record with joined vehicle/location data
 * @param vehicle - Vehicle details
 * @param appBaseUrl - Base URL of the SPFx webpart (for deep links)
 */
export function buildConfirmationEmailHtml(
  booking: {
    id: number;
    startTime: string;
    endTime: string;
  },
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
    categoryName: string;
    locationName: string;
  },
  appBaseUrl: string
): string {
  const viewUrl = `${escapeHtml(appBaseUrl)}?bookingId=${booking.id}`;
  const cancelUrl = `${escapeHtml(appBaseUrl)}?bookingId=${booking.id}&amp;action=cancel`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="background-color: #0078D4; padding: 24px 32px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Booking Confirmed</h1>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #333333;">
          Your vehicle booking has been confirmed. Here are the details:
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0; width: 120px;">Booking ID</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${booking.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">Vehicle</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} (${escapeHtml(vehicle.licensePlate)})</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">Category</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${escapeHtml(vehicle.categoryName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">Location</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${escapeHtml(vehicle.locationName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">Pickup</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${formatDateTime(booking.startTime)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">Return</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${formatDateTime(booking.endTime)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: 600; color: #333333; font-size: 14px;">Status</td>
            <td style="padding: 8px 0; color: #107C10; font-size: 14px; font-weight: 600;">Confirmed</td>
          </tr>
        </table>
        <!-- Action Buttons -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="padding-right: 12px;">
              <a href="${viewUrl}" style="display: inline-block; background-color: #0078D4; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">View Booking</a>
            </td>
            <td>
              <a href="${cancelUrl}" style="display: inline-block; background-color: #D13438; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">Cancel Booking</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px; background-color: #fafafa; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; font-size: 12px; color: #888888; text-align: center;">
          This is an automated message from RentAVehicle. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
