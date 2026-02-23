import { useMemo } from 'react';

export interface ITimezoneFormatters {
  formatDateTime: (utcDate: string | Date) => string;
  formatDateOnly: (utcDate: string | Date) => string;
  formatTimeOnly: (utcDate: string | Date) => string;
  timezoneAbbr: string;
  ianaTimezone: string;
}

/**
 * Extract timezone abbreviation from a formatted date string.
 * Formats a date with timeZoneName: 'short' and extracts the timezone part.
 * Works with ES5 target (no formatToParts needed).
 */
function extractTimezoneAbbr(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    // Format returns something like "2/23/2026, EST" or "2/23/2026, GMT+2"
    const formatted = formatter.format(new Date());
    // Extract the timezone part after the last comma+space
    const commaIndex = formatted.lastIndexOf(', ');
    if (commaIndex >= 0) {
      return formatted.substring(commaIndex + 2);
    }
    return tz;
  } catch (e) {
    void e; // suppress unused variable lint
    return tz;
  }
}

/**
 * React hook that returns memoized date/time formatters for a given IANA timezone.
 * All formatters convert UTC dates into the specified timezone for display.
 *
 * @param timezone - IANA timezone identifier (e.g. 'Europe/Bucharest')
 */
export function useTimezone(timezone: string): ITimezoneFormatters {
  return useMemo(function buildFormatters(): ITimezoneFormatters {
    const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const dateOnlyFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const timeOnlyFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const timezoneAbbr = extractTimezoneAbbr(timezone);

    const toDate = function toDateFn(input: string | Date): Date {
      return typeof input === 'string' ? new Date(input) : input;
    };

    return {
      formatDateTime: function formatDateTimeFn(utcDate: string | Date): string {
        return dateTimeFormatter.format(toDate(utcDate));
      },
      formatDateOnly: function formatDateOnlyFn(utcDate: string | Date): string {
        return dateOnlyFormatter.format(toDate(utcDate));
      },
      formatTimeOnly: function formatTimeOnlyFn(utcDate: string | Date): string {
        return timeOnlyFormatter.format(toDate(utcDate));
      },
      timezoneAbbr: timezoneAbbr,
      ianaTimezone: timezone,
    };
  }, [timezone]);
}

/**
 * Pad a number to two digits with leading zero.
 * ES5-compatible alternative to String.padStart(2, '0').
 */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/**
 * Convert a user-selected local date+hour (in the given IANA timezone) to a UTC ISO string.
 * Used by BookingForm to send UTC times to the API.
 *
 * Strategy: Use Intl.DateTimeFormat to determine the UTC offset of the timezone
 * at the specified date. Format a known UTC date with and without timezone conversion,
 * then compute the difference to find the offset.
 *
 * @param year - Local year
 * @param month - Local month (1-12)
 * @param day - Local day (1-31)
 * @param hour - Local hour (0-23)
 * @param ianaTimezone - IANA timezone identifier
 * @returns ISO 8601 UTC string (e.g. '2026-03-15T08:00:00.000Z')
 */
export function localToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  ianaTimezone: string
): string {
  // Create a rough UTC estimate to probe the timezone offset at this date
  const roughUtc = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));

  // Get the UTC offset by formatting with timeZoneName and parsing
  // Format includes timeZoneName which shows offset info
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse the formatted local time to extract date components
  const localFormatted = offsetFormatter.format(roughUtc);
  // en-US with hour12:false gives "MM/DD/YYYY, HH:MM:SS"
  const dateTimeParts = localFormatted.split(', ');
  const dateParts = dateTimeParts[0].split('/');
  const timeParts = dateTimeParts[1].split(':');

  const localMonth = parseInt(dateParts[0], 10);
  const localDay = parseInt(dateParts[1], 10);
  const localYear = parseInt(dateParts[2], 10);
  let localHour = parseInt(timeParts[0], 10);
  // Intl.DateTimeFormat with hour12:false may return "24" for midnight
  if (localHour === 24) localHour = 0;

  // Compute the offset: local time formatted - UTC time
  const utcMs = roughUtc.getTime();
  const localAsUtc = Date.UTC(localYear, localMonth - 1, localDay, localHour,
    parseInt(timeParts[1], 10), parseInt(timeParts[2], 10));
  const offsetMs = localAsUtc - utcMs;
  const offsetMinutes = Math.round(offsetMs / 60000);

  // Now convert the desired local time to UTC: UTC = local - offset
  const desiredLocalMs = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  const resultUtcMs = desiredLocalMs - offsetMinutes * 60 * 1000;
  const result = new Date(resultUtcMs);

  // Build ISO string manually (avoids potential toISOString polyfill issues)
  return result.getUTCFullYear() + '-' +
    pad2(result.getUTCMonth() + 1) + '-' +
    pad2(result.getUTCDate()) + 'T' +
    pad2(result.getUTCHours()) + ':' +
    pad2(result.getUTCMinutes()) + ':' +
    pad2(result.getUTCSeconds()) + '.000Z';
}
