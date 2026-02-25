import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './VehicleDetail.module.scss';
import suggestionStyles from '../MyBookings/MyBookings.module.scss';
import { ApiService } from '../../services/ApiService';
import { IConflictResponse, IBookingSuggestion, IVehicleAvailabilitySlot } from '../../models/IBooking';
import { useTimezone, localToUtcIso } from '../../hooks/useTimezone';
import { RangeCalendar, IRangeState } from './RangeCalendar';

export interface IBookingFormProps {
  vehicleId: number;
  vehicleName: string;
  locationName: string;
  locationTimezone: string;
  apiService: ApiService;
  onBookingComplete: (bookingId: number) => void;
  onConflict: () => void;
  onNavigateToVehicle?: (vehicleId: number) => void;
  range: IRangeState;
  onRangeChange: (partial: Partial<IRangeState>) => void;
  availabilitySlots?: IVehicleAvailabilitySlot[];
  onSelectionSummary?: (summary: string) => void;
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

/**
 * Filter hour options to exclude past hours when selectedDate is today.
 * Returns only hours strictly greater than the current hour when today is selected.
 */
function getFilteredHourOptions(selectedDate: Date): IDropdownOption[] {
  const now = new Date();
  const isToday = selectedDate.getFullYear() === now.getFullYear()
    && selectedDate.getMonth() === now.getMonth()
    && selectedDate.getDate() === now.getDate();

  if (!isToday) return HOUR_OPTIONS;

  const currentHour = now.getHours();
  const filtered: IDropdownOption[] = [];
  for (let i = 0; i < HOUR_OPTIONS.length; i++) {
    if ((HOUR_OPTIONS[i].key as number) > currentHour) {
      filtered.push(HOUR_OPTIONS[i]);
    }
  }
  return filtered;
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
  range,
  onRangeChange,
  availabilitySlots,
  onSelectionSummary,
}) => {
  const tz = useTimezone(locationTimezone);

  // Form state
  const [formState, setFormState] = React.useState<FormState>('selection');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = React.useState<IBookingSuggestion[]>([]);

  // Emit selection summary to parent for mobile sticky bottom bar
  React.useEffect(function emitSummary(): void {
    if (onSelectionSummary) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const sameDay = range.startDate.getTime() === range.endDate.getTime();
      const summaryLabel = sameDay
        ? months[range.startDate.getMonth()] + ' ' + range.startDate.getDate() + ', ' + pad2(range.startHour) + ':00\u2013' + pad2(range.endHour) + ':00'
        : months[range.startDate.getMonth()] + ' ' + range.startDate.getDate() + ' ' + pad2(range.startHour) + ':00 \u2013 ' + months[range.endDate.getMonth()] + ' ' + range.endDate.getDate() + ' ' + pad2(range.endHour) + ':00';
      onSelectionSummary(summaryLabel);
    }
  }, [range.startDate, range.startHour, range.endDate, range.endHour, onSelectionSummary]);

  // Computed UTC times for review and submission
  const startTimeUtc = React.useMemo(function computeStart(): string {
    return localToUtcIso(
      range.startDate.getFullYear(),
      range.startDate.getMonth() + 1,
      range.startDate.getDate(),
      range.startHour,
      locationTimezone
    );
  }, [range.startDate, range.startHour, locationTimezone]);

  const endTimeUtc = React.useMemo(function computeEnd(): string {
    return localToUtcIso(
      range.endDate.getFullYear(),
      range.endDate.getMonth() + 1,
      range.endDate.getDate(),
      range.endHour,
      locationTimezone
    );
  }, [range.endDate, range.endHour, locationTimezone]);

  // Overlap warning: check if form selection conflicts with a booked slot
  const overlapWarning = React.useMemo(function checkOverlap(): boolean {
    if (!availabilitySlots || availabilitySlots.length === 0) return false;
    const formStartMs = new Date(startTimeUtc).getTime();
    const formEndMs = new Date(endTimeUtc).getTime();
    if (isNaN(formStartMs) || isNaN(formEndMs) || formEndMs <= formStartMs) return false;
    for (let i = 0; i < availabilitySlots.length; i++) {
      const slotStartMs = new Date(availabilitySlots[i].startTime).getTime();
      const slotEndMs = new Date(availabilitySlots[i].endTime).getTime();
      if (formStartMs < slotEndMs && formEndMs > slotStartMs) return true;
    }
    return false;
  }, [availabilitySlots, startTimeUtc, endTimeUtc]);

  // Filtered hour options based on whether today is selected
  const startHourOptions = React.useMemo(function filterStartHours(): IDropdownOption[] {
    return getFilteredHourOptions(range.startDate);
  }, [range.startDate]);

  const endHourOptions = React.useMemo(function filterEndHours(): IDropdownOption[] {
    return getFilteredHourOptions(range.endDate);
  }, [range.endDate]);

  // Handlers -- use onRangeChange to update hours via range state
  const handleStartHourChange = React.useCallback(
    function onStartHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) {
        onRangeChange({ startHour: option.key as number });
        setSuggestions([]);
      }
    },
    [onRangeChange]
  );

  const handleEndHourChange = React.useCallback(
    function onEndHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) {
        onRangeChange({ endHour: option.key as number });
        setSuggestions([]);
      }
    },
    [onRangeChange]
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
        setFormState('selection');
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
                // Parse suggestion times and update range
                const sugStart = new Date(suggestion.startTime);
                const sugEnd = new Date(suggestion.endTime);
                onRangeChange({
                  startDate: new Date(sugStart.getFullYear(), sugStart.getMonth(), sugStart.getDate()),
                  endDate: new Date(sugEnd.getFullYear(), sugEnd.getMonth(), sugEnd.getDate()),
                  startHour: sugStart.getHours(),
                  endHour: sugEnd.getHours(),
                });
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
        <RangeCalendar
          range={range}
          onRangeChange={onRangeChange}
        />

        <div className={styles.formRow}>
          <div className={styles.formField}>
            <Dropdown
              label={'Start time (' + tz.timezoneAbbr + ')'}
              selectedKey={range.startHour}
              options={startHourOptions}
              onChange={handleStartHourChange}
            />
          </div>
          <div className={styles.formField}>
            <Dropdown
              label={'End time (' + tz.timezoneAbbr + ')'}
              selectedKey={range.endHour}
              options={endHourOptions}
              onChange={handleEndHourChange}
            />
          </div>
        </div>

        <div className={styles.timezoneNote}>
          All times are in {locationTimezone} ({tz.timezoneAbbr})
        </div>
      </div>

      {/* Overlap warning when form selection conflicts with a booked slot */}
      {overlapWarning && (
        <div className={styles.overlapWarning}>
          <MessageBar messageBarType={MessageBarType.warning} isMultiline={false}>
            This slot appears booked. You can still submit — the server will verify availability.
          </MessageBar>
        </div>
      )}

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
