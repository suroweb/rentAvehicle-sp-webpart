import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { DayOfWeek } from '@fluentui/react/lib/Calendar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './VehicleDetail.module.scss';
import suggestionStyles from '../MyBookings/MyBookings.module.scss';
import { ApiService } from '../../services/ApiService';
import { IConflictResponse, IBookingSuggestion, IVehicleAvailabilitySlot } from '../../models/IBooking';
import { useTimezone, localToUtcIso } from '../../hooks/useTimezone';

export interface IBookingFormProps {
  vehicleId: number;
  vehicleName: string;
  locationName: string;
  locationTimezone: string;
  apiService: ApiService;
  onBookingComplete: (bookingId: number) => void;
  onConflict: () => void;
  onNavigateToVehicle?: (vehicleId: number) => void;
  prefillDate?: Date;
  prefillStartHour?: number;
  onFormDateChange?: (date: Date) => void;
  availabilitySlots?: IVehicleAvailabilitySlot[];
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
  onNavigateToVehicle,
  prefillDate,
  prefillStartHour,
  onFormDateChange,
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
  const [suggestions, setSuggestions] = React.useState<IBookingSuggestion[]>([]);

  // Apply prefill from timeline slot click
  React.useEffect(function applyPrefill(): void {
    if (prefillDate !== undefined) {
      setStartDate(prefillDate);
      setEndDate(prefillDate);
      setFormState('selection');
      setError(undefined);
      setSuggestions([]);
    }
    if (prefillStartHour !== undefined) {
      setStartHour(prefillStartHour);
      const nextHr = prefillStartHour >= 23 ? 23 : prefillStartHour + 1;
      setEndHour(nextHr);
    }
  }, [prefillDate, prefillStartHour]);

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
    if (date) {
      setStartDate(date);
      setSuggestions([]);
      if (onFormDateChange) {
        onFormDateChange(date);
      }
    }
  }, [onFormDateChange]);

  const handleEndDateChange = React.useCallback(function onEndDateChange(date: Date | null | undefined): void {
    if (date) {
      setEndDate(date);
      setSuggestions([]);
    }
  }, []);

  const handleStartHourChange = React.useCallback(
    function onStartHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) {
        setStartHour(option.key as number);
        setSuggestions([]);
      }
    },
    []
  );

  const handleEndHourChange = React.useCallback(
    function onEndHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) {
        setEndHour(option.key as number);
        setSuggestions([]);
      }
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
    setSuggestions([]);

    try {
      const result = await apiService.createBooking({
        vehicleId: vehicleId,
        startTime: startTimeUtc,
        endTime: endTimeUtc,
      });

      // Check for conflict response (409 now returns structured object instead of throwing)
      if (result && 'conflict' in result && (result as IConflictResponse).conflict) {
        const conflictResult = result as IConflictResponse;
        setError(conflictResult.message || 'This slot was just booked by someone else. Please choose a different time.');
        setSuggestions(conflictResult.suggestions || []);
        setFormState('selection');
        onConflict();
      } else {
        const successResult = result as { id: number };
        onBookingComplete(successResult.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      setError(message);
      setFormState('review');
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
          onDismiss={function dismissError(): void { setError(undefined); setSuggestions([]); }}
          dismissButtonAriaLabel="Close"
        >
          {error}
        </MessageBar>
      )}

      {/* Inline suggestions on 409 conflict */}
      {suggestions.length > 0 && (
        <div className={suggestionStyles.suggestionsSection}>
          <div className={suggestionStyles.suggestionsTitle}>Available alternatives:</div>
          {suggestions.map(function renderSuggestion(suggestion: IBookingSuggestion, idx: number): React.ReactElement {
            const handleSuggestionClick = function onSuggestionClick(): void {
              if (suggestion.type === 'time_shift') {
                // Parse suggestion times and update form
                const sugStart = new Date(suggestion.startTime);
                const sugEnd = new Date(suggestion.endTime);
                setStartDate(new Date(sugStart.getFullYear(), sugStart.getMonth(), sugStart.getDate()));
                setEndDate(new Date(sugEnd.getFullYear(), sugEnd.getMonth(), sugEnd.getDate()));
                setStartHour(sugStart.getHours());
                setEndHour(sugEnd.getHours());
                setSuggestions([]);
                setError(undefined);
              } else if (suggestion.type === 'alt_vehicle' && onNavigateToVehicle) {
                onNavigateToVehicle(suggestion.vehicleId);
              }
            };

            const timeLabel = suggestion.type === 'time_shift'
              ? (tz.formatDateTime(suggestion.startTime) + ' - ' + tz.formatDateTime(suggestion.endTime) + ' (' + tz.timezoneAbbr + ')')
              : (suggestion.vehicleName + ', same time');

            return (
              <div
                key={idx}
                className={suggestionStyles.suggestionCard}
                onClick={handleSuggestionClick}
                role="button"
                tabIndex={0}
                onKeyDown={function onKey(e: React.KeyboardEvent): void {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSuggestionClick();
                  }
                }}
              >
                <div className={suggestionStyles.suggestionLabel}>{suggestion.label}</div>
                <div className={suggestionStyles.suggestionDetail}>{timeLabel}</div>
              </div>
            );
          })}
        </div>
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
