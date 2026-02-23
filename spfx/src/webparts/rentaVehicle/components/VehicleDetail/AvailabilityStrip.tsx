import * as React from 'react';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import styles from './VehicleDetail.module.scss';
import { IVehicleAvailabilitySlot } from '../../models/IBooking';
import { useTimezone } from '../../hooks/useTimezone';

export interface IAvailabilityStripProps {
  slots: IVehicleAvailabilitySlot[];
  timezone: string;
  days?: number;
}

// Display hours range for the strip (8:00 - 20:00)
const STRIP_START_HOUR = 8;
const STRIP_END_HOUR = 20;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/**
 * Get the next N days starting from today.
 * Returns an array of Date objects representing each day at midnight local time.
 */
function getNextDays(count: number): Date[] {
  const result: Date[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    result.push(d);
  }
  return result;
}

interface IHourBlock {
  hour: number;
  isBooked: boolean;
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
 * AvailabilityStrip - compact 7-day availability visualization.
 * Shows a horizontal strip with one column per day. Each column displays
 * colored blocks for 8:00-20:00 indicating booked (red) vs free (green) hours.
 */
export const AvailabilityStrip: React.FC<IAvailabilityStripProps> = ({
  slots,
  timezone,
  days = 7,
}) => {
  const tz = useTimezone(timezone);

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

  // Build the days and their hour blocks
  const dayColumns = React.useMemo(function buildColumns() {
    const nextDays = getNextDays(days);

    return nextDays.map(function buildDayColumn(dayDate: Date) {
      const dayLabel = DAY_LABELS[dayDate.getDay()];
      const dateLabel = pad2(dayDate.getDate()) + '/' + pad2(dayDate.getMonth() + 1);

      // Build hour blocks for this day
      const hourBlocks: IHourBlock[] = [];
      for (let h = STRIP_START_HOUR; h < STRIP_END_HOUR; h++) {
        let isBooked = false;
        let tooltipText = pad2(h) + ':00 - ' + pad2(h + 1) + ':00 ' + tz.timezoneAbbr + ': Free';

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

        hourBlocks.push({ hour: h, isBooked: isBooked, tooltip: tooltipText });
      }

      return {
        dayLabel: dayLabel,
        dateLabel: dateLabel,
        hourBlocks: hourBlocks,
      };
    });
  }, [slots, days, tz, localFormatter]);

  return (
    <div className={styles.availabilityStrip}>
      <div className={styles.stripHeader}>
        <span className={styles.stripTitle}>Availability (next {days} days)</span>
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
          {[STRIP_START_HOUR, STRIP_START_HOUR + 4, STRIP_START_HOUR + 8, STRIP_END_HOUR].map(
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
          return (
            <div key={idx} className={styles.stripDayColumn}>
              <div className={styles.stripDayHeader}>
                <div className={styles.stripDayName}>{col.dayLabel}</div>
                <div className={styles.stripDate}>{col.dateLabel}</div>
              </div>
              <div className={styles.stripBlocks}>
                {col.hourBlocks.map(function renderBlock(block) {
                  return (
                    <TooltipHost
                      key={block.hour}
                      content={block.tooltip}
                    >
                      <div
                        className={
                          block.isBooked
                            ? styles.stripBlockBooked
                            : styles.stripBlockFree
                        }
                      />
                    </TooltipHost>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
