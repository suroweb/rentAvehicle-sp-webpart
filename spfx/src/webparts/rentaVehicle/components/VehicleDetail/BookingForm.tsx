import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { DayOfWeek } from '@fluentui/react/lib/Calendar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './VehicleDetail.module.scss';
import { ApiService } from '../../services/ApiService';
import { useTimezone, localToUtcIso } from '../../hooks/useTimezone';

export interface IBookingFormProps {
  vehicleId: number;
  vehicleName: string;
  locationName: string;
  locationTimezone: string;
  apiService: ApiService;
  onBookingComplete: (bookingId: number) => void;
  onConflict: () => void;
}

type FormState = 'selection' | 'review' | 'submitting';

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

// Generate hour dropdown options (0:00 through 23:00)
const HOUR_OPTIONS: IDropdownOption[] = [];
for (let i = 0; i < 24; i++) {
  HOUR_OPTIONS.push({ key: i, text: pad2(i) + ':00' });
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getNextFullHour(): number {
  const now = new Date();
  const nextHour = now.getHours() + 1;
  return nextHour >= 24 ? 0 : nextHour;
}

export const BookingForm: React.FC<IBookingFormProps> = ({
  vehicleId,
  vehicleName,
  locationName,
  locationTimezone,
  apiService,
  onBookingComplete,
  onConflict,
}) => {
  const tz = useTimezone(locationTimezone);

  // Form state
  const [formState, setFormState] = React.useState<FormState>('selection');
  const [startDate, setStartDate] = React.useState<Date>(getToday);
  const [endDate, setEndDate] = React.useState<Date>(getToday);
  const [startHour, setStartHour] = React.useState<number>(getNextFullHour);
  const [endHour, setEndHour] = React.useState<number>(function initEndHour(): number {
    const next = getNextFullHour();
    return next >= 23 ? 23 : next + 1;
  });
  const [error, setError] = React.useState<string | undefined>(undefined);

  // Computed UTC times for review and submission
  const startTimeUtc = React.useMemo(function computeStart(): string {
    return localToUtcIso(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startHour,
      locationTimezone
    );
  }, [startDate, startHour, locationTimezone]);

  const endTimeUtc = React.useMemo(function computeEnd(): string {
    return localToUtcIso(
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endHour,
      locationTimezone
    );
  }, [endDate, endHour, locationTimezone]);

  // Handlers
  const handleStartDateChange = React.useCallback(function onStartDateChange(date: Date | null | undefined): void {
    if (date) setStartDate(date);
  }, []);

  const handleEndDateChange = React.useCallback(function onEndDateChange(date: Date | null | undefined): void {
    if (date) setEndDate(date);
  }, []);

  const handleStartHourChange = React.useCallback(
    function onStartHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) setStartHour(option.key as number);
    },
    []
  );

  const handleEndHourChange = React.useCallback(
    function onEndHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) setEndHour(option.key as number);
    },
    []
  );

  const handleReview = React.useCallback(function onReview(): void {
    setError(undefined);

    // Validate end is after start
    if (new Date(endTimeUtc) <= new Date(startTimeUtc)) {
      setError('End date/time must be after start date/time');
      return;
    }

    setFormState('review');
  }, [startTimeUtc, endTimeUtc]);

  const handleBack = React.useCallback(function onBack(): void {
    setFormState('selection');
    setError(undefined);
  }, []);

  const handleConfirm = React.useCallback(async function onConfirm(): Promise<void> {
    setFormState('submitting');
    setError(undefined);

    try {
      const result = await apiService.createBooking({
        vehicleId: vehicleId,
        startTime: startTimeUtc,
        endTime: endTimeUtc,
      });
      onBookingComplete(result.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';

      // Check for 409 conflict
      if (message.indexOf('CONFLICT:') === 0) {
        setError('This slot was just booked by someone else. Please choose a different time.');
        setFormState('selection');
        onConflict();
      } else {
        setError(message);
        setFormState('review');
      }
    }
  }, [vehicleId, startTimeUtc, endTimeUtc, apiService, onBookingComplete, onConflict]);

  // Submitting state
  if (formState === 'submitting') {
    return (
      <div className={styles.bookingForm}>
        <h3 className={styles.formTitle}>Book This Vehicle</h3>
        <div className={styles.formSpinner}>
          <Spinner size={SpinnerSize.medium} label="Creating your booking..." />
        </div>
      </div>
    );
  }

  // Review state
  if (formState === 'review') {
    return (
      <div className={styles.bookingForm}>
        <h3 className={styles.formTitle}>Review Booking</h3>

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={function dismissError(): void { setError(undefined); }}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}

        <div className={styles.reviewPanel}>
          <div className={styles.reviewRow}>
            <span className={styles.reviewLabel}>Vehicle</span>
            <span className={styles.reviewValue}>{vehicleName}</span>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewLabel}>Location</span>
            <span className={styles.reviewValue}>{locationName}</span>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewLabel}>Start</span>
            <span className={styles.reviewValue}>
              {tz.formatDateTime(startTimeUtc)} ({tz.timezoneAbbr})
            </span>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewLabel}>End</span>
            <span className={styles.reviewValue}>
              {tz.formatDateTime(endTimeUtc)} ({tz.timezoneAbbr})
            </span>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewLabel}>Timezone</span>
            <span className={styles.reviewValue}>{locationTimezone}</span>
          </div>
        </div>

        <div className={styles.formActions}>
          <PrimaryButton
            text="Confirm Booking"
            onClick={handleConfirm}
            iconProps={{ iconName: 'Accept' }}
          />
          <DefaultButton text="Back" onClick={handleBack} />
        </div>
      </div>
    );
  }

  // Selection state (default)
  return (
    <div className={styles.bookingForm}>
      <h3 className={styles.formTitle}>Book This Vehicle</h3>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={function dismissError(): void { setError(undefined); }}
          dismissButtonAriaLabel="Close"
        >
          {error}
        </MessageBar>
      )}

      <div className={styles.formFields}>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <DatePicker
              label="Start date"
              value={startDate}
              onSelectDate={handleStartDateChange}
              firstDayOfWeek={DayOfWeek.Monday}
              minDate={getToday()}
              formatDate={function fmtDate(date?: Date): string {
                return date
                  ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
              }}
            />
          </div>
          <div className={styles.formFieldNarrow}>
            <Dropdown
              label={'Start time (' + tz.timezoneAbbr + ')'}
              selectedKey={startHour}
              options={HOUR_OPTIONS}
              onChange={handleStartHourChange}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formField}>
            <DatePicker
              label="End date"
              value={endDate}
              onSelectDate={handleEndDateChange}
              firstDayOfWeek={DayOfWeek.Monday}
              minDate={startDate}
              formatDate={function fmtDate(date?: Date): string {
                return date
                  ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
              }}
            />
          </div>
          <div className={styles.formFieldNarrow}>
            <Dropdown
              label={'End time (' + tz.timezoneAbbr + ')'}
              selectedKey={endHour}
              options={HOUR_OPTIONS}
              onChange={handleEndHourChange}
            />
          </div>
        </div>

        <div className={styles.timezoneNote}>
          All times are in {locationTimezone} ({tz.timezoneAbbr})
        </div>
      </div>

      <div className={styles.formActions}>
        <PrimaryButton
          text="Review Booking"
          onClick={handleReview}
          iconProps={{ iconName: 'EventAccepted' }}
        />
      </div>
    </div>
  );
};
