import * as React from 'react';
import { IconButton } from '@fluentui/react/lib/Button';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import styles from './VehicleDetail.module.scss';
import { IVehicleAvailabilitySlot } from '../../models/IBooking';
import { useTimezone } from '../../hooks/useTimezone';
import { useResponsive } from '../../hooks/useResponsive';
import { IRangeState } from './RangeCalendar';

export interface IAvailabilityStripProps {
  slots: IVehicleAvailabilitySlot[];
  timezone: string;
  days?: number;
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSlotClick: (dayDate: Date, hour: number) => void;
  range: IRangeState;
  onRangeChange: (partial: Partial<IRangeState>) => void;
}

// Display hours range for the strip (8:00 - 20:00)
const STRIP_START_HOUR = 8;
const STRIP_END_HOUR = 20;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/**
 * Get N days starting from today offset by weekOffset weeks.
 * Returns an array of Date objects representing each day at midnight local time.
 */
function getNextDays(count: number, weekOffset: number): Date[] {
  const result: Date[] = [];
  const now = new Date();
  const startDay = weekOffset * 7;
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + startDay + i);
    result.push(d);
  }
  return result;
}

interface IHourBlock {
  hour: number;
  isBooked: boolean;
  isPast: boolean;
  tooltip: string;
}

/**
 * Parse a formatted date string in "DD/MM/YYYY, HH:MM" format (en-GB with hour12:false).
 * Returns components for comparison.
 */
function parseFormattedLocal(formatted: string): { day: number; month: number; year: number; hour: number; minute: number } {
  const mainParts = formatted.split(', ');
  const dParts = mainParts[0].split('/');
  const tParts = mainParts[1].split(':');
  let parsedHour = parseInt(tParts[0], 10);
  if (parsedHour === 24) parsedHour = 0;
  return {
    day: parseInt(dParts[0], 10),
    month: parseInt(dParts[1], 10),
    year: parseInt(dParts[2], 10),
    hour: parsedHour,
    minute: parseInt(tParts[1], 10),
  };
}

/**
 * Convert date components to comparable "minutes" value for overlap checking.
 * Uses year/month/day encoded into a large number plus hours*60+minutes.
 */
function toComparableMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  return ((year * 10000 + month * 100 + day) * 1440) + hour * 60 + minute;
}

/**
 * AvailabilityStrip - compact 7-day availability visualization with week navigation.
 * Shows a horizontal strip with one column per day. Each column displays
 * colored blocks for 8:00-20:00 indicating booked (red) vs free (green) hours.
 * Free slots are clickable to pre-fill the booking form.
 * Left/right arrows navigate between weeks.
 */
/**
 * Compute per-day overlay data for the range within the visible week.
 * Returns null if the range does not overlap the given day.
 */
function computeDayOverlay(
  range: IRangeState,
  dayDate: Date,
  stripStartHour: number,
  stripEndHour: number
): { topPercent: number; heightPercent: number } | null {
  const rangeStartMs = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate()).getTime();
  const rangeEndMs = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate()).getTime();
  const dayMs = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();

  // Day is outside range
  if (dayMs < rangeStartMs || dayMs > rangeEndMs) return null;

  const totalBlocks = stripEndHour - stripStartHour;
  if (totalBlocks <= 0) return null;

  const isStartDay = dayMs === rangeStartMs;
  const isEndDay = dayMs === rangeEndMs;

  // Determine start hour index within this column
  let startHourInCol = 0;
  if (isStartDay) {
    startHourInCol = Math.max(0, range.startHour - stripStartHour);
  }

  // Determine end hour index within this column
  let endHourInCol = totalBlocks;
  if (isEndDay) {
    endHourInCol = Math.max(0, Math.min(totalBlocks, range.endHour - stripStartHour));
  }

  if (endHourInCol <= startHourInCol) return null;

  const topPercent = (startHourInCol / totalBlocks) * 100;
  const heightPercent = ((endHourInCol - startHourInCol) / totalBlocks) * 100;

  return { topPercent: topPercent, heightPercent: heightPercent };
}

export const AvailabilityStrip: React.FC<IAvailabilityStripProps> = ({
  slots,
  timezone,
  days = 7,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onSlotClick,
  range,
  onRangeChange,
}) => {
  const tz = useTimezone(timezone);
  const { isMobile } = useResponsive();

  // Track whether next strip click sets start or end of range
  const stripSelectingEnd = React.useRef<boolean>(false);

  // On mobile, limit visible hours to business hours (8-18) for wider touch targets
  const mobileEndHour = isMobile ? 18 : STRIP_END_HOUR;

  // Create a shared formatter for slot times to avoid re-creating per iteration
  const localFormatter = React.useMemo(function createFormatter(): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [timezone]);

  // Get today at midnight for today-column highlight
  const todayMidnight = React.useMemo(function getTodayMidnight(): number {
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return t.getTime();
  }, []);

  // Build the days and their hour blocks
  const dayColumns = React.useMemo(function buildColumns() {
    const nextDays = getNextDays(days, weekOffset);
    const nowHour = new Date().getHours();
    const endHourForLoop = mobileEndHour;

    return nextDays.map(function buildDayColumn(dayDate: Date) {
      const dayLabel = DAY_LABELS[dayDate.getDay()];
      const dateLabel = pad2(dayDate.getDate()) + '/' + pad2(dayDate.getMonth() + 1);
      const isToday = dayDate.getTime() === todayMidnight;

      // Build hour blocks for this day
      const hourBlocks: IHourBlock[] = [];
      for (let h = STRIP_START_HOUR; h < endHourForLoop; h++) {
        let isBooked = false;
        const isPast = isToday && h <= nowHour;
        let tooltipText = isPast
          ? pad2(h) + ':00 - ' + pad2(h + 1) + ':00 ' + tz.timezoneAbbr + ': Past'
          : pad2(h) + ':00 - ' + pad2(h + 1) + ':00 ' + tz.timezoneAbbr + ': Free';

        // Compute block time range in comparable minutes (local frame)
        const blockDay = dayDate.getDate();
        const blockMonth = dayDate.getMonth() + 1;
        const blockYear = dayDate.getFullYear();
        const blockStartMin = toComparableMinutes(blockYear, blockMonth, blockDay, h, 0);
        const blockEndMin = blockStartMin + 60;

        for (let s = 0; s < slots.length; s++) {
          const slot = slots[s];

          // Format slot UTC times into local timezone for comparison
          const slotStartFormatted = localFormatter.format(new Date(slot.startTime));
          const slotEndFormatted = localFormatter.format(new Date(slot.endTime));

          const sStart = parseFormattedLocal(slotStartFormatted);
          const sEnd = parseFormattedLocal(slotEndFormatted);

          const slotStartMin = toComparableMinutes(sStart.year, sStart.month, sStart.day, sStart.hour, sStart.minute);
          const slotEndMin = toComparableMinutes(sEnd.year, sEnd.month, sEnd.day, sEnd.hour, sEnd.minute);

          // Overlap check: slot start < block end AND slot end > block start
          if (slotStartMin < blockEndMin && slotEndMin > blockStartMin) {
            isBooked = true;
            tooltipText = pad2(h) + ':00 - ' + pad2(h + 1) + ':00 ' + tz.timezoneAbbr + ': Booked';
            break;
          }
        }

        hourBlocks.push({ hour: h, isBooked: isBooked, isPast: isPast, tooltip: tooltipText });
      }

      return {
        dayDate: dayDate,
        dayLabel: dayLabel,
        dateLabel: dateLabel,
        isToday: isToday,
        hourBlocks: hourBlocks,
      };
    });
  }, [slots, days, weekOffset, tz, localFormatter, todayMidnight, mobileEndHour]);

  // Compute week range label for header (e.g., "25 Feb - 3 Mar")
  const weekRangeLabel = React.useMemo(function computeRangeLabel(): string {
    if (dayColumns.length === 0) return '';
    const first = dayColumns[0].dayDate;
    const last = dayColumns[dayColumns.length - 1].dayDate;
    const startLabel = String(first.getDate()) + ' ' + MONTH_LABELS[first.getMonth()];
    const endLabel = String(last.getDate()) + ' ' + MONTH_LABELS[last.getMonth()];
    return startLabel + ' - ' + endLabel;
  }, [dayColumns]);

  return (
    <div className={styles.availabilityStrip}>
      <div className={styles.stripHeader}>
        <div className={styles.stripNav}>
          <IconButton
            iconProps={{ iconName: 'ChevronLeft' }}
            title="Previous week"
            ariaLabel="Previous week"
            disabled={weekOffset === 0}
            onClick={onPrevWeek}
            className={styles.stripNavButton}
          />
          <span className={styles.stripTitle}>{'Availability: ' + weekRangeLabel}</span>
          <IconButton
            iconProps={{ iconName: 'ChevronRight' }}
            title="Next week"
            ariaLabel="Next week"
            disabled={weekOffset >= 7}
            onClick={onNextWeek}
            className={styles.stripNavButton}
          />
        </div>
        <span className={styles.stripTimezone}>{tz.timezoneAbbr}</span>
        <div className={styles.stripLegend}>
          <span className={styles.legendItem}>
            <span className={styles.legendFree} /> Free
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendBooked} /> Booked
          </span>
        </div>
      </div>
      <div className={styles.stripGrid}>
        {/* Hour labels column */}
        <div className={styles.stripHourLabels}>
          <div className={styles.stripDayHeader}>&nbsp;</div>
          {(isMobile
            ? [STRIP_START_HOUR, STRIP_START_HOUR + 5, mobileEndHour]
            : [STRIP_START_HOUR, STRIP_START_HOUR + 4, STRIP_START_HOUR + 8, STRIP_END_HOUR]
          ).map(
            function renderHourLabel(h: number) {
              return (
                <div key={h} className={styles.stripHourLabel}>
                  {pad2(h)}:00
                </div>
              );
            }
          )}
        </div>

        {/* Day columns */}
        {dayColumns.map(function renderDayColumn(col, idx) {
          const columnClass = col.isToday
            ? styles.stripDayColumn + ' ' + styles.stripDayColumnToday
            : styles.stripDayColumn;

          return (
            <div key={idx} className={columnClass}>
              <div className={styles.stripDayHeader}>
                <div className={styles.stripDayName}>{col.dayLabel}</div>
                <div className={styles.stripDate}>{col.dateLabel}</div>
              </div>
              <div className={styles.stripBlocks}>
                {col.hourBlocks.map(function renderBlock(block) {
                  // Past slots: grayed out, non-clickable
                  if (block.isPast) {
                    return (
                      <TooltipHost key={block.hour} content={block.tooltip}>
                        <div className={styles.stripBlockPast} />
                      </TooltipHost>
                    );
                  }

                  // Booked slots: red, non-clickable
                  if (block.isBooked) {
                    return (
                      <TooltipHost key={block.hour} content={block.tooltip}>
                        <div className={styles.stripBlockBooked} />
                      </TooltipHost>
                    );
                  }

                  // Free future slots: green, clickable with two-click range selection
                  return (
                    <TooltipHost key={block.hour} content={block.tooltip}>
                      <div
                        className={styles.stripBlockFree}
                        onClick={function onFreeSlotClick(): void {
                          // Two-click range selection on the strip
                          if (!stripSelectingEnd.current) {
                            // First click: set start, collapse end to same slot
                            onRangeChange({
                              startDate: col.dayDate,
                              startHour: block.hour,
                              endDate: col.dayDate,
                              endHour: block.hour >= 23 ? 23 : block.hour + 1,
                            });
                            stripSelectingEnd.current = true;
                          } else {
                            // Second click: set end, swap if clicked before start
                            const clickedMs = new Date(col.dayDate.getFullYear(), col.dayDate.getMonth(), col.dayDate.getDate()).getTime();
                            const startMs = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate()).getTime();
                            const endHourVal = block.hour >= 23 ? 23 : block.hour + 1;

                            if (clickedMs < startMs || (clickedMs === startMs && block.hour < range.startHour)) {
                              // Clicked before current start -- swap
                              onRangeChange({
                                startDate: col.dayDate,
                                startHour: block.hour,
                                endDate: range.startDate,
                                endHour: range.startHour >= 23 ? 23 : range.startHour + 1,
                              });
                            } else {
                              onRangeChange({
                                endDate: col.dayDate,
                                endHour: endHourVal,
                              });
                            }
                            stripSelectingEnd.current = false;
                          }
                          // Also call original onSlotClick for backward compat
                          onSlotClick(col.dayDate, block.hour);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={function onKey(e: React.KeyboardEvent): void {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onSlotClick(col.dayDate, block.hour);
                          }
                        }}
                      />
                    </TooltipHost>
                  );
                })}

                {/* Range overlay for this day column */}
                {(function renderDayOverlay(): React.ReactNode {
                  const overlay = computeDayOverlay(range, col.dayDate, STRIP_START_HOUR, mobileEndHour);
                  if (!overlay) return null;
                  return (
                    <div
                      className={styles.rangeOverlay}
                      style={{
                        top: overlay.topPercent + '%',
                        height: overlay.heightPercent + '%',
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
