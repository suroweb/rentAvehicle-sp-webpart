import * as React from 'react';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { IconButton } from '@fluentui/react/lib/Button';
import { DayOfWeek } from '@fluentui/react/lib/Calendar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import styles from './AvailabilityTimeline.module.scss';
import { ApiService } from '../../services/ApiService';
import { ITimelineData, ITimelineBooking, IAvailableVehicle } from '../../models/IBooking';
import { useTimezone } from '../../hooks/useTimezone';
import { useResponsive } from '../../hooks/useResponsive';
import { IRangeState } from './RangeCalendar';

export interface IAvailabilityTimelineProps {
  apiService: ApiService;
  locationId: number;
  locationTimezone: string;
  currentUserId: string;
  onSlotClick: (vehicleId: number, date: string, startHour: number) => void;
  range: IRangeState;
  onRangeChange: (partial: Partial<IRangeState>) => void;
}

// Display hours range (8:00 - 20:00 = 12 columns)
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 20;
const TOTAL_HOUR_COLUMNS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** Normalize a Date to midnight for day-level comparison */
function toDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const AvailabilityTimeline: React.FC<IAvailabilityTimelineProps> = function AvailabilityTimeline(props) {
  const apiService = props.apiService;
  const locationId = props.locationId;
  const locationTimezone = props.locationTimezone;
  const currentUserId = props.currentUserId;
  const onSlotClick = props.onSlotClick;
  const range = props.range;
  const onRangeChange = props.onRangeChange;

  const tz = useTimezone(locationTimezone);
  const { isMobile } = useResponsive();

  const [selectedDate, setSelectedDate] = React.useState(getToday);
  const [timelineData, setTimelineData] = React.useState<ITimelineData | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);

  // Mobile: active vehicle index for single-vehicle vertical view
  const [activeVehicleIndex, setActiveVehicleIndex] = React.useState<number>(0);

  // Mobile: horizontal swipe detection for vehicle switching
  const touchStartRef = React.useRef<number>(0);

  // Drag state for Day View range overlay handles
  const draggingEdge = React.useRef<'start' | 'end' | null>(null);

  // Two-click selection state for Day View
  const dayViewSelectingEnd = React.useRef<boolean>(false);

  const handleMobileTouchStart = React.useCallback(function onTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    touchStartRef.current = e.touches[0].clientX;
  }, []);

  const handleMobileTouchEnd = React.useCallback(function onTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    if (!timelineData) return;
    const vehicleCount = timelineData.vehicles.length;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0 && activeVehicleIndex < vehicleCount - 1) {
        setActiveVehicleIndex(activeVehicleIndex + 1);
      } else if (deltaX > 0 && activeVehicleIndex > 0) {
        setActiveVehicleIndex(activeVehicleIndex - 1);
      }
    }
  }, [activeVehicleIndex, timelineData]);

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

  // Day-by-day arrow navigation handlers
  const handlePrevDay = React.useCallback(function onPrevDay(): void {
    const prev = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1);
    const today = getToday();
    if (prev >= today) {
      setSelectedDate(prev);
    }
  }, [selectedDate]);

  const handleNextDay = React.useCallback(function onNextDay(): void {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1));
  }, [selectedDate]);

  // Compute range overlay boundaries for the current day
  const selectedDayMs = toDayMs(selectedDate);
  const rangeStartDayMs = toDayMs(range.startDate);
  const rangeEndDayMs = toDayMs(range.endDate);
  const isDayInRange = selectedDayMs >= rangeStartDayMs && selectedDayMs <= rangeEndDayMs;

  let overlayStartHour = TIMELINE_START_HOUR;
  let overlayEndHour = TIMELINE_END_HOUR;

  if (isDayInRange) {
    if (selectedDayMs === rangeStartDayMs) {
      overlayStartHour = Math.max(range.startHour, TIMELINE_START_HOUR);
    }
    if (selectedDayMs === rangeEndDayMs) {
      overlayEndHour = Math.min(range.endHour, TIMELINE_END_HOUR);
    }
  }

  // Build a global booked hours set from ALL bookings on selectedDate (conservative snap boundary)
  const allBookedHoursSet = React.useMemo(function buildBookedHoursSet(): Set<number> {
    const set = new Set<number>();
    if (!timelineData) return set;
    for (let b = 0; b < timelineData.bookings.length; b++) {
      const booking = timelineData.bookings[b];
      const span = getBookingHourSpan(booking, selectedDate, localFormatter);
      if (span === undefined) continue;
      for (let h = span.startCol - 2; h < span.endCol - 2; h++) {
        if (h >= 0 && h < TOTAL_HOUR_COLUMNS) {
          set.add(h + TIMELINE_START_HOUR);
        }
      }
    }
    return set;
  }, [timelineData, selectedDate, localFormatter]);

  /** Snap a target hour to the nearest free hour in the appropriate direction */
  function snapToFreeHour(targetHour: number, edge: 'start' | 'end'): number {
    if (!allBookedHoursSet.has(targetHour)) return targetHour;
    if (edge === 'end') {
      for (let h = targetHour - 1; h >= TIMELINE_START_HOUR; h--) {
        if (!allBookedHoursSet.has(h)) return h;
      }
      return TIMELINE_START_HOUR;
    } else {
      for (let h = targetHour + 1; h < TIMELINE_END_HOUR; h++) {
        if (!allBookedHoursSet.has(h)) return h;
      }
      return TIMELINE_END_HOUR - 1;
    }
  }

  /** Map pointer X to an hour column for Day View drag */
  const handleDayViewDragMove = React.useCallback(function onDragMove(
    e: React.PointerEvent<HTMLDivElement>
  ): void {
    if (!draggingEdge.current) return;

    const grid = (e.currentTarget as HTMLElement).closest('.' + styles.timelineGrid) as HTMLElement | null;
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    // First column (180px) is vehicle labels
    const labelWidth = 180;
    const hourAreaWidth = gridRect.width - labelWidth;
    const relativeX = e.clientX - gridRect.left - labelWidth;
    const hourIndex = Math.floor(relativeX / (hourAreaWidth / TOTAL_HOUR_COLUMNS));
    const targetHour = Math.max(TIMELINE_START_HOUR, Math.min(TIMELINE_END_HOUR - 1, hourIndex + TIMELINE_START_HOUR));
    const snappedHour = snapToFreeHour(targetHour, draggingEdge.current);

    if (draggingEdge.current === 'start') {
      if (snappedHour < range.endHour) {
        onRangeChange({ startHour: snappedHour });
      }
    } else {
      const endVal = snappedHour >= 23 ? 23 : snappedHour + 1;
      if (endVal > range.startHour) {
        onRangeChange({ endHour: endVal });
      }
    }
  }, [range.startHour, range.endHour, onRangeChange, allBookedHoursSet]);

  const handleDayViewDragUp = React.useCallback(function onDragUp(
    e: React.PointerEvent<HTMLDivElement>
  ): void {
    if (draggingEdge.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      draggingEdge.current = null;
    }
  }, []);

  /** Two-click selection on Day View free slots */
  const handleDayViewSlotClick = React.useCallback(function onDayViewSlotClick(
    vehicleId: number,
    dateStr: string,
    hour: number
  ): void {
    if (!dayViewSelectingEnd.current) {
      // First click: set start
      onRangeChange({
        startDate: selectedDate,
        startHour: hour,
        endDate: selectedDate,
        endHour: hour >= 23 ? 23 : hour + 1,
      });
      dayViewSelectingEnd.current = true;
    } else {
      // Second click: set end hour
      const endVal = hour >= 23 ? 23 : hour + 1;
      if (endVal > range.startHour) {
        onRangeChange({ endHour: endVal });
      } else {
        // Clicked before start -- swap
        onRangeChange({
          startHour: hour,
          endHour: range.startHour >= 23 ? 23 : range.startHour + 1,
        });
      }
      dayViewSelectingEnd.current = false;
    }
    // Also call existing onSlotClick for backward compatibility
    onSlotClick(vehicleId, dateStr, hour);
  }, [selectedDate, range.startHour, onRangeChange, onSlotClick]);

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

  // Check if selected date is today for past-slot graying
  const isSelectedDateToday = React.useMemo(function checkIsToday(): boolean {
    const today = getToday();
    return selectedDate.getTime() === today.getTime();
  }, [selectedDate]);

  const currentHour = React.useMemo(function getCurrentHour(): number {
    return new Date().getHours();
  }, []);

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

  // Check if previous day button should be disabled (cannot go before today)
  const isPrevDayDisabled = selectedDate.getTime() <= getToday().getTime();

  // Multi-day range header text for compact display
  const rangeHeaderText = React.useMemo(function buildRangeHeader(): string | null {
    if (toDayMs(range.startDate) === toDayMs(range.endDate)) return null;
    return MONTH_LABELS[range.startDate.getMonth()] + ' ' + range.startDate.getDate() + ' ' + pad2(range.startHour) + ':00'
      + ' \u2013 '
      + MONTH_LABELS[range.endDate.getMonth()] + ' ' + range.endDate.getDate() + ' ' + pad2(range.endHour) + ':00';
  }, [range]);

  // Loading
  if (loading) {
    return React.createElement('div', { className: styles.timelineContainer },
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement('div', { className: styles.timelineNav },
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronLeft' },
            title: 'Previous day',
            ariaLabel: 'Previous day',
            onClick: handlePrevDay,
            disabled: isPrevDayDisabled,
          }),
          React.createElement(DatePicker, datePickerProps),
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronRight' },
            title: 'Next day',
            ariaLabel: 'Next day',
            onClick: handleNextDay,
          })
        ),
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
        React.createElement('div', { className: styles.timelineNav },
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronLeft' },
            title: 'Previous day',
            ariaLabel: 'Previous day',
            onClick: handlePrevDay,
            disabled: isPrevDayDisabled,
          }),
          React.createElement(DatePicker, datePickerProps),
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronRight' },
            title: 'Next day',
            ariaLabel: 'Next day',
            onClick: handleNextDay,
          })
        )
      ),
      React.createElement('div', { className: styles.errorText }, error)
    );
  }

  // Empty state
  if (!timelineData || timelineData.vehicles.length === 0) {
    return React.createElement('div', { className: styles.timelineContainer },
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement('div', { className: styles.timelineNav },
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronLeft' },
            title: 'Previous day',
            ariaLabel: 'Previous day',
            onClick: handlePrevDay,
            disabled: isPrevDayDisabled,
          }),
          React.createElement(DatePicker, datePickerProps),
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronRight' },
            title: 'Next day',
            ariaLabel: 'Next day',
            onClick: handleNextDay,
          })
        )
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

    // Free slot cells (with past-slot graying)
    for (let fh = 0; fh < TOTAL_HOUR_COLUMNS; fh++) {
      if (!bookedHours[fh]) {
        const slotHour = fh + TIMELINE_START_HOUR;
        const isPast = isSelectedDateToday && slotHour <= currentHour;

        if (isPast) {
          // Past slot -- grayed out, non-clickable
          vehicleRows.push(
            React.createElement('div', {
              key: 'past-' + String(vehicle.id) + '-' + String(slotHour),
              className: styles.pastSlot,
              style: {
                gridColumn: String(fh + 2),
                gridRow: String(v + 2),
              },
              title: pad2(slotHour) + ':00 - Past',
            })
          );
        } else {
          // Future free slot -- clickable (use two-click handler)
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
                  handleDayViewSlotClick(vid, ds, sh);
                };
              })(vehicle.id, dateStr, slotHour),
              title: pad2(slotHour) + ':00 - Free',
            })
          );
        }
      }
    }

    // Add booking blocks for this vehicle
    for (let bbi = 0; bbi < bookingBlocks.length; bbi++) {
      vehicleRows.push(bookingBlocks[bbi]);
    }
  }

  // Build range overlay and drag handles for desktop grid
  const rangeOverlayElements: React.ReactElement[] = [];
  if (isDayInRange && overlayEndHour > overlayStartHour) {
    // Range overlay band spanning all vehicle rows
    rangeOverlayElements.push(
      React.createElement('div', {
        key: 'range-overlay',
        className: styles.dayViewRangeOverlay,
        style: {
          gridColumn: (overlayStartHour - TIMELINE_START_HOUR + 2) + ' / ' + (overlayEndHour - TIMELINE_START_HOUR + 2),
          gridRow: '2 / ' + String(vehicles.length + 2),
        },
      })
    );

    // Start drag handle -- only when selectedDate is the range start day
    if (selectedDayMs === rangeStartDayMs) {
      rangeOverlayElements.push(
        React.createElement('div', {
          key: 'drag-start',
          className: styles.dayViewDragHandle + ' ' + styles.dayViewDragHandleStart,
          style: {
            gridColumn: String(overlayStartHour - TIMELINE_START_HOUR + 2),
            gridRow: '2 / ' + String(vehicles.length + 2),
          },
          onPointerDown: function onStartDrag(e: React.PointerEvent<HTMLDivElement>): void {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            draggingEdge.current = 'start';
          },
          onPointerMove: handleDayViewDragMove,
          onPointerUp: handleDayViewDragUp,
        })
      );
    }

    // End drag handle -- only when selectedDate is the range end day
    if (selectedDayMs === rangeEndDayMs) {
      rangeOverlayElements.push(
        React.createElement('div', {
          key: 'drag-end',
          className: styles.dayViewDragHandle + ' ' + styles.dayViewDragHandleEnd,
          style: {
            gridColumn: String(overlayEndHour - TIMELINE_START_HOUR + 1),
            gridRow: '2 / ' + String(vehicles.length + 2),
          },
          onPointerDown: function onEndDrag(e: React.PointerEvent<HTMLDivElement>): void {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            draggingEdge.current = 'end';
          },
          onPointerMove: handleDayViewDragMove,
          onPointerUp: handleDayViewDragUp,
        })
      );
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

  // Mobile vertical view: single vehicle at a time with swipe navigation
  if (isMobile) {
    const safeIndex = activeVehicleIndex < vehicles.length ? activeVehicleIndex : 0;
    const activeVehicle = vehicles[safeIndex];

    // Get bookings for active vehicle
    const activeBookings: ITimelineBooking[] = [];
    for (let ab = 0; ab < bookings.length; ab++) {
      if (bookings[ab].vehicleId === activeVehicle.id) {
        activeBookings.push(bookings[ab]);
      }
    }

    // Build booked hours map for active vehicle
    const mobileBookedHours: { [hour: number]: string } = {};
    for (let mbi = 0; mbi < activeBookings.length; mbi++) {
      const mbooking = activeBookings[mbi];
      const mspan = getBookingHourSpan(mbooking, selectedDate, localFormatter);
      if (mspan === undefined) continue;
      for (let mh = mspan.startCol - 2; mh < mspan.endCol - 2; mh++) {
        if (mh >= 0 && mh < TOTAL_HOUR_COLUMNS) {
          mobileBookedHours[mh + TIMELINE_START_HOUR] = mbooking.userDisplayName || 'Booked';
        }
      }
    }

    // Build mobile hour range
    const mobileHourRange: number[] = [];
    for (let mhr = TIMELINE_START_HOUR; mhr < TIMELINE_END_HOUR; mhr++) {
      mobileHourRange.push(mhr);
    }

    const mobileVehicleHeader = React.createElement('div', { className: styles.mobileVehicleHeader },
      React.createElement(IconButton, {
        iconProps: { iconName: 'ChevronLeft' },
        onClick: function goToPrevVehicle(): void { if (safeIndex > 0) setActiveVehicleIndex(safeIndex - 1); },
        disabled: safeIndex === 0,
        title: 'Previous vehicle',
        ariaLabel: 'Previous vehicle',
      }),
      React.createElement('span', { className: styles.mobileVehicleName },
        activeVehicle.make + ' ' + activeVehicle.model + ' (' + String(safeIndex + 1) + '/' + String(vehicles.length) + ')'
      ),
      React.createElement(IconButton, {
        iconProps: { iconName: 'ChevronRight' },
        onClick: function goToNextVehicle(): void { if (safeIndex < vehicles.length - 1) setActiveVehicleIndex(safeIndex + 1); },
        disabled: safeIndex === vehicles.length - 1,
        title: 'Next vehicle',
        ariaLabel: 'Next vehicle',
      })
    );

    const mobileSlotRows = mobileHourRange.map(function renderMobileSlot(hour: number): React.ReactElement {
      const isBookedMobile = mobileBookedHours[hour] !== undefined;
      const isPastMobile = isSelectedDateToday && hour <= currentHour;

      // Determine if this slot is within the range for mobile highlighting
      const isSlotInRange = isDayInRange && hour >= overlayStartHour && hour < overlayEndHour;
      const isSlotRangeStart = isSlotInRange && hour === overlayStartHour;
      const isSlotRangeEnd = isSlotInRange && hour === (overlayEndHour - 1);

      let slotClassName = isPastMobile
        ? styles.mobileSlotPast
        : isBookedMobile
          ? styles.mobileSlotBooked
          : styles.mobileSlotFree;

      // Add range highlight classes for mobile
      if (isSlotInRange && !isPastMobile) {
        slotClassName = slotClassName + ' ' + styles.mobileSlotInRange;
      }
      if (isSlotRangeStart && !isPastMobile) {
        slotClassName = slotClassName + ' ' + styles.mobileSlotRangeStart;
      }
      if (isSlotRangeEnd && !isPastMobile) {
        slotClassName = slotClassName + ' ' + styles.mobileSlotRangeEnd;
      }

      const statusText = isPastMobile
        ? 'Past'
        : isBookedMobile
          ? mobileBookedHours[hour]
          : 'Available \u2014 tap to book';

      const slotClickHandler = (!isBookedMobile && !isPastMobile)
        ? (function makeHandler(vid: number, ds: string, sh: number) {
            return function onMobileSlotClick(): void {
              handleDayViewSlotClick(vid, ds, sh);
            };
          })(activeVehicle.id, dateStr, hour)
        : undefined;

      return React.createElement('div', {
        key: hour,
        className: slotClassName,
        onClick: slotClickHandler,
      },
        React.createElement('span', { className: styles.mobileSlotHour }, pad2(hour) + ':00'),
        React.createElement('span', { className: styles.mobileSlotStatus }, statusText)
      );
    });

    return React.createElement('div', { className: styles.timelineContainer },
      // Compact full-range header when multi-day
      rangeHeaderText
        ? React.createElement('div', { className: styles.rangeHeaderCompact }, rangeHeaderText)
        : null,
      React.createElement('div', { className: styles.timelineHeader },
        React.createElement('div', { className: styles.timelineNav },
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronLeft' },
            title: 'Previous day',
            ariaLabel: 'Previous day',
            onClick: handlePrevDay,
            disabled: isPrevDayDisabled,
          }),
          React.createElement(DatePicker, datePickerProps),
          React.createElement(IconButton, {
            iconProps: { iconName: 'ChevronRight' },
            title: 'Next day',
            ariaLabel: 'Next day',
            onClick: handleNextDay,
          })
        ),
        React.createElement('span', { className: styles.dayLabel },
          tz.formatDateOnly(selectedDate) + ' (' + tz.timezoneAbbr + ')'
        ),
        legend
      ),
      mobileVehicleHeader,
      React.createElement('div', {
        className: styles.mobileSlotList,
        onTouchStart: handleMobileTouchStart,
        onTouchEnd: handleMobileTouchEnd,
      }, mobileSlotRows)
    );
  }

  // Desktop: CSS Grid view
  return React.createElement('div', { className: styles.timelineContainer },
    // Compact full-range header when multi-day
    rangeHeaderText
      ? React.createElement('div', { className: styles.rangeHeaderCompact }, rangeHeaderText)
      : null,
    React.createElement('div', { className: styles.timelineHeader },
      React.createElement('div', { className: styles.timelineNav },
        React.createElement(IconButton, {
          iconProps: { iconName: 'ChevronLeft' },
          title: 'Previous day',
          ariaLabel: 'Previous day',
          onClick: handlePrevDay,
          disabled: isPrevDayDisabled,
        }),
        React.createElement(DatePicker, datePickerProps),
        React.createElement(IconButton, {
          iconProps: { iconName: 'ChevronRight' },
          title: 'Next day',
          ariaLabel: 'Next day',
          onClick: handleNextDay,
        })
      ),
      React.createElement('span', { className: styles.dayLabel },
        tz.formatDateOnly(selectedDate) + ' (' + tz.timezoneAbbr + ')'
      ),
      legend
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
        vehicleRows.map(function renderRow(row) { return row; }),
        // Range overlay and drag handles
        rangeOverlayElements.map(function renderOverlay(el) { return el; })
      )
    )
  );
};
