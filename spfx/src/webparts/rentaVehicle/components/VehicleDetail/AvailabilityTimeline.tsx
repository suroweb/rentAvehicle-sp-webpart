import * as React from 'react';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { DayOfWeek } from '@fluentui/react/lib/Calendar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import styles from './AvailabilityTimeline.module.scss';
import { ApiService } from '../../services/ApiService';
import { ITimelineData, ITimelineBooking, IAvailableVehicle } from '../../models/IBooking';
import { useTimezone } from '../../hooks/useTimezone';

export interface IAvailabilityTimelineProps {
  apiService: ApiService;
  locationId: number;
  locationTimezone: string;
  currentUserId: string;
  onSlotClick: (vehicleId: number, date: string, startHour: number) => void;
}

// Display hours range (8:00 - 20:00 = 12 columns)
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 20;
const TOTAL_HOUR_COLUMNS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDateString(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * Parse a formatted date string in "DD/MM/YYYY, HH:MM" format (en-GB with hour12:false).
 * Returns the hour in local timezone.
 */
function parseLocalHour(formatted: string): number {
  const mainParts = formatted.split(', ');
  const tParts = mainParts[1].split(':');
  let parsedHour = parseInt(tParts[0], 10);
  if (parsedHour === 24) parsedHour = 0;
  return parsedHour;
}

/**
 * Get the local start and end hours for a booking on the given day.
 * Returns { startCol, endCol } clamped to the timeline range.
 */
function getBookingHourSpan(
  booking: ITimelineBooking,
  dayDate: Date,
  formatter: Intl.DateTimeFormat
): { startCol: number; endCol: number } | undefined {
  const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
  const dayEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1);

  const bookingStart = new Date(booking.startTime);
  const bookingEnd = new Date(booking.endTime);

  // No overlap with this day
  if (bookingEnd <= dayStart || bookingStart >= dayEnd) {
    return undefined;
  }

  let startHour: number;
  let endHour: number;

  if (bookingStart <= dayStart) {
    startHour = 0;
  } else {
    const startFormatted = formatter.format(bookingStart);
    startHour = parseLocalHour(startFormatted);
  }

  if (bookingEnd >= dayEnd) {
    endHour = 24;
  } else {
    const endFormatted = formatter.format(bookingEnd);
    endHour = parseLocalHour(endFormatted);
    // If end minute is > 0, round up to next hour for display
    const endParts = endFormatted.split(', ')[1].split(':');
    if (parseInt(endParts[1], 10) > 0) {
      endHour = endHour + 1;
    }
  }

  // Clamp to timeline range
  const clampedStart = Math.max(startHour, TIMELINE_START_HOUR);
  const clampedEnd = Math.min(endHour, TIMELINE_END_HOUR);

  if (clampedStart >= clampedEnd) {
    return undefined;
  }

  // Convert to grid column indices (1-based, first column is vehicle label)
  // Column 2 = hour 8, column 3 = hour 9, etc.
  const startCol = clampedStart - TIMELINE_START_HOUR + 2;
  const endCol = clampedEnd - TIMELINE_START_HOUR + 2;

  return { startCol: startCol, endCol: endCol };
}

export const AvailabilityTimeline: React.FC<IAvailabilityTimelineProps> = function AvailabilityTimeline(props) {
  const apiService = props.apiService;
  const locationId = props.locationId;
  const locationTimezone = props.locationTimezone;
  const currentUserId = props.currentUserId;
  const onSlotClick = props.onSlotClick;

  const tz = useTimezone(locationTimezone);

  const [selectedDate, setSelectedDate] = React.useState(getToday);
  const [timelineData, setTimelineData] = React.useState<ITimelineData | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);

  // Formatter for converting UTC booking times to local timezone
  const localFormatter = React.useMemo(function createFormatter(): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: locationTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [locationTimezone]);

  // Fetch timeline data on mount and date change
  React.useEffect(function loadTimeline(): () => void {
    let cancelled = false;
    const dateStr = formatDateString(selectedDate);

    setLoading(true);
    setError(undefined);

    apiService.getTimeline(locationId, dateStr)
      .then(function onSuccess(data: ITimelineData): void {
        if (!cancelled) {
          setTimelineData(data);
          setLoading(false);
        }
      })
      .catch(function onError(err: unknown): void {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load timeline';
          setError(message);
          setLoading(false);
        }
      });

    return function cleanup(): void {
      cancelled = true;
    };
  }, [locationId, selectedDate, apiService]);

  const handleDateChange = React.useCallback(function onDateChange(date: Date | undefined | null): void {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  // Build hour labels
  const hourLabels: React.ReactElement[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
    hourLabels.push(
      React.createElement('div', {
        key: h,
        className: styles.hourLabel,
        style: { gridColumn: String(h - TIMELINE_START_HOUR + 2) },
      }, pad2(h) + ':00')
    );
  }

  const dateStr = formatDateString(selectedDate);

  // Shared DatePicker props builder
  const datePickerProps = {
    label: 'Select date',
    value: selectedDate,
    onSelectDate: handleDateChange,
    firstDayOfWeek: DayOfWeek.Monday,
    minDate: getToday(),
    formatDate: function fmtDate(date?: Date): string {
      return date
        ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
    },
  };

  // Loading
  if (loading) {
    return React.createElement('div', { className: styles.timelineContainer },
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement(DatePicker, datePickerProps),
        React.createElement('span', { className: styles.dayLabel },
          tz.formatDateOnly(selectedDate) + ' (' + tz.timezoneAbbr + ')'
        )
      ),
      React.createElement('div', { className: styles.loadingContainer },
        React.createElement(Spinner, { size: SpinnerSize.medium, label: 'Loading timeline...' })
      )
    );
  }

  // Error
  if (error) {
    return React.createElement('div', { className: styles.timelineContainer },
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement(DatePicker, datePickerProps)
      ),
      React.createElement('div', { className: styles.errorText }, error)
    );
  }

  // Empty state
  if (!timelineData || timelineData.vehicles.length === 0) {
    return React.createElement('div', { className: styles.timelineContainer },
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement(DatePicker, datePickerProps)
      ),
      React.createElement('div', { className: styles.emptyState }, 'No vehicles at this location')
    );
  }

  const vehicles: IAvailableVehicle[] = timelineData.vehicles;
  const bookings: ITimelineBooking[] = timelineData.bookings;

  // Build vehicle rows
  const vehicleRows: React.ReactElement[] = [];
  for (let v = 0; v < vehicles.length; v++) {
    const vehicle = vehicles[v];
    const vehicleLabel = vehicle.make + ' ' + vehicle.model;
    const vehiclePlate = vehicle.licensePlate;

    // Get bookings for this vehicle
    const vehicleBookings: ITimelineBooking[] = [];
    for (let b = 0; b < bookings.length; b++) {
      if (bookings[b].vehicleId === vehicle.id) {
        vehicleBookings.push(bookings[b]);
      }
    }

    // Build booked hours set for free-slot detection
    const bookedHours: boolean[] = [];
    for (let bh = 0; bh < TOTAL_HOUR_COLUMNS; bh++) {
      bookedHours.push(false);
    }

    // Booking blocks
    const bookingBlocks: React.ReactElement[] = [];
    for (let bi = 0; bi < vehicleBookings.length; bi++) {
      const booking = vehicleBookings[bi];
      const span = getBookingHourSpan(booking, selectedDate, localFormatter);
      if (span === undefined) continue;

      // Mark hours as booked
      for (let mh = span.startCol - 2; mh < span.endCol - 2; mh++) {
        if (mh >= 0 && mh < TOTAL_HOUR_COLUMNS) {
          bookedHours[mh] = true;
        }
      }

      const isOwn = booking.userId === currentUserId;
      const isOverdue = booking.status === 'Overdue';
      const blockClass = isOverdue
        ? styles.overdueBooking
        : isOwn
          ? styles.ownBooking
          : styles.othersBooking;

      const displayName = booking.userDisplayName || 'Booked';

      bookingBlocks.push(
        React.createElement('div', {
          key: 'booking-' + String(booking.bookingId),
          className: blockClass,
          style: {
            gridColumn: String(span.startCol) + ' / ' + String(span.endCol),
            gridRow: String(v + 2),
          },
          title: displayName + ' (' + pad2((span.startCol - 2) + TIMELINE_START_HOUR) + ':00 - ' + pad2((span.endCol - 2) + TIMELINE_START_HOUR) + ':00)',
        }, displayName)
      );
    }

    // Vehicle label cell
    vehicleRows.push(
      React.createElement('div', {
        key: 'label-' + String(vehicle.id),
        className: styles.vehicleLabel,
        style: { gridRow: String(v + 2), gridColumn: '1' },
        title: vehicleLabel + ' ' + vehiclePlate,
      },
        React.createElement('div', { className: styles.vehicleName }, vehicleLabel),
        React.createElement('div', { className: styles.vehiclePlate }, vehiclePlate)
      )
    );

    // Free slot cells
    for (let fh = 0; fh < TOTAL_HOUR_COLUMNS; fh++) {
      if (!bookedHours[fh]) {
        const slotHour = fh + TIMELINE_START_HOUR;
        vehicleRows.push(
          React.createElement('div', {
            key: 'free-' + String(vehicle.id) + '-' + String(slotHour),
            className: styles.freeSlot,
            style: {
              gridColumn: String(fh + 2),
              gridRow: String(v + 2),
            },
            onClick: (function makeClickHandler(vid: number, ds: string, sh: number) {
              return function handleSlotClick(): void {
                onSlotClick(vid, ds, sh);
              };
            })(vehicle.id, dateStr, slotHour),
            title: pad2(slotHour) + ':00 - Free',
          })
        );
      }
    }

    // Add booking blocks for this vehicle
    for (let bbi = 0; bbi < bookingBlocks.length; bbi++) {
      vehicleRows.push(bookingBlocks[bbi]);
    }
  }

  // Legend
  const legend = React.createElement('div', { className: styles.legend },
    React.createElement('span', { className: styles.legendItem },
      React.createElement('span', { className: styles.legendDotOwn }), ' Your bookings'
    ),
    React.createElement('span', { className: styles.legendItem },
      React.createElement('span', { className: styles.legendDotOthers }), ' Others'
    ),
    React.createElement('span', { className: styles.legendItem },
      React.createElement('span', { className: styles.legendDotOverdue }), ' Overdue'
    ),
    React.createElement('span', { className: styles.legendItem },
      React.createElement('span', { className: styles.legendDotFree }), ' Free'
    )
  );

  return React.createElement('div', { className: styles.timelineContainer },
    React.createElement('div', { className: styles.timelineHeader },
      React.createElement(DatePicker, datePickerProps),
      React.createElement('span', { className: styles.dayLabel },
        tz.formatDateOnly(selectedDate) + ' (' + tz.timezoneAbbr + ')'
      ),
      legend
    ),
    React.createElement('div', { className: styles.mobileHint },
      'For best experience, use landscape or desktop view.'
    ),
    React.createElement('div', { className: styles.gridWrapper },
      React.createElement('div', {
        className: styles.timelineGrid,
        style: {
          gridTemplateRows: 'auto repeat(' + String(vehicles.length) + ', 40px)',
        },
      },
        // Hour header row
        React.createElement('div', {
          className: styles.cornerCell,
          style: { gridColumn: '1', gridRow: '1' },
        }, 'Vehicle'),
        hourLabels.map(function renderLabel(label) { return label; }),
        // Vehicle rows with free slots and booking blocks
        vehicleRows.map(function renderRow(row) { return row; })
      )
    )
  );
};
