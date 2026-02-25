import * as React from 'react';
import { Calendar, DayOfWeek } from '@fluentui/react/lib/Calendar';
import styles from './RangeCalendar.module.scss';

/**
 * Single source of truth for date range state.
 * Used across VehicleDetail, BookingForm, and AvailabilityStrip.
 */
export interface IRangeState {
  startDate: Date;
  startHour: number;
  endDate: Date;
  endHour: number;
}

interface IRangeCalendarProps {
  range: IRangeState;
  onRangeChange: (partial: Partial<IRangeState>) => void;
  minDate?: Date;
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const RangeCalendar: React.FC<IRangeCalendarProps> = ({
  range,
  onRangeChange,
  minDate,
}) => {
  // Track whether next click sets start or end
  const [selectingEnd, setSelectingEnd] = React.useState<boolean>(false);

  const handleSelectDate = React.useCallback(function onSelect(date: Date): void {
    if (!selectingEnd) {
      // First click: set start date, reset end to same date
      onRangeChange({ startDate: date, endDate: date });
      setSelectingEnd(true);
    } else {
      // Second click: set end date (swap if before start)
      const startMs = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate()).getTime();
      const clickedMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (clickedMs < startMs) {
        // Clicked before start -- swap: clicked becomes start, old start becomes end
        onRangeChange({ startDate: date, endDate: range.startDate });
      } else {
        // Clicked on or after start -- set as end date
        onRangeChange({ endDate: date });
      }
      setSelectingEnd(false);
    }
  }, [selectingEnd, range.startDate, onRangeChange]);

  // customDayCellRef: apply CSS classes for start, end, and in-range dates
  const customDayCellRef = React.useCallback(function styleDayCell(
    element: HTMLElement, date: Date
  ): void {
    // Guard against null — Fluent UI calls ref callbacks with null during unmount
    if (!element || !date) return;

    const dayMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const startMs = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate()).getTime();
    const endMs = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate()).getTime();

    // Clear previous range classes
    element.classList.remove('rangeStart', 'rangeEnd', 'inRange');

    if (dayMs === startMs) {
      element.classList.add('rangeStart');
    }
    if (dayMs === endMs) {
      element.classList.add('rangeEnd');
    }
    if (dayMs > startMs && dayMs < endMs) {
      element.classList.add('inRange');
    }
  }, [range.startDate, range.endDate]);

  // Force Calendar re-mount when range changes to ensure customDayCellRef fires for all cells
  const calendarKey = range.startDate.getTime() + '-' + range.endDate.getTime();

  return (
    <div className={styles.rangeCalendarContainer}>
      <Calendar
        key={calendarKey}
        value={range.startDate}
        onSelectDate={handleSelectDate}
        firstDayOfWeek={DayOfWeek.Monday}
        isMonthPickerVisible={false}
        showGoToToday={false}
        minDate={minDate || getToday()}
        calendarDayProps={{ customDayCellRef: customDayCellRef }}
      />
      <div className={styles.selectionHint}>
        {selectingEnd ? 'Click end date' : ''}
      </div>
    </div>
  );
};
