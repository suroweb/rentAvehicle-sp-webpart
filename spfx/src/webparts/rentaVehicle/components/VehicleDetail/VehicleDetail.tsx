import * as React from 'react';
import { IconButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Icon } from '@fluentui/react/lib/Icon';
import { Link } from '@fluentui/react/lib/Link';
import styles from './VehicleDetail.module.scss';
import { ApiService } from '../../services/ApiService';
import { IAvailableVehicle, IVehicleAvailabilitySlot } from '../../models/IBooking';
import { AvailabilityStrip } from './AvailabilityStrip';
import { BookingForm } from './BookingForm';
import { BottomSheet } from './BottomSheet';
import { StickyBottomBar } from './StickyBottomBar';
import { useResponsive } from '../../hooks/useResponsive';
import { IRangeState } from './RangeCalendar';

export interface IVehicleDetailProps {
  vehicleId: number;
  apiService: ApiService;
  currentUserId: string;
  onBack: () => void;
  onNavigateToMyBookings: () => void;
  onNavigateToVehicle?: (vehicleId: number) => void;
  initialStartDate?: Date;
  initialStartHour?: number;
  initialEndDate?: Date;
  initialEndHour?: number;
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
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

export const VehicleDetail: React.FC<IVehicleDetailProps> = ({
  vehicleId,
  apiService,
  currentUserId,
  onBack,
  onNavigateToMyBookings,
  onNavigateToVehicle,
  initialStartDate,
  initialStartHour,
  initialEndDate,
  initialEndHour,
}) => {
  const [vehicle, setVehicle] = React.useState<IAvailableVehicle | undefined>(undefined);
  const [availabilitySlots, setAvailabilitySlots] = React.useState<IVehicleAvailabilitySlot[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [bookingSuccess, setBookingSuccess] = React.useState<boolean>(false);

  // Unified range state -- single source of truth for date/time selection
  const [range, setRange] = React.useState<IRangeState>(function initRange(): IRangeState {
    const today = getToday();
    const defaultStartHour = initialStartHour !== undefined ? initialStartHour : getNextFullHour();
    // If nextHour wrapped to 0 (i.e. it's 23:xx) and no explicit dates passed, use tomorrow
    const needsTomorrow = defaultStartHour === 0 && !initialStartDate;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultStart = initialStartDate || (needsTomorrow ? tomorrow : today);
    const defaultEnd = initialEndDate || defaultStart;
    const defaultEndHour = initialEndHour !== undefined
      ? initialEndHour
      : (needsTomorrow ? 9 : (defaultStartHour >= 23 ? 23 : defaultStartHour + 1));
    return {
      startDate: defaultStart,
      startHour: needsTomorrow ? 8 : defaultStartHour,
      endDate: defaultEnd,
      endHour: defaultEndHour,
    };
  });

  // Partial update helper -- preserves other fields
  const updateRange = React.useCallback(function onUpdateRange(partial: Partial<IRangeState>): void {
    setRange(function mergeRange(prev: IRangeState): IRangeState {
      return { ...prev, ...partial };
    });
  }, []);

  // Mobile state
  const { isMobile } = useResponsive();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = React.useState<boolean>(false);
  const [selectionLabel, setSelectionLabel] = React.useState<string>('');

  // Week navigation state for AvailabilityStrip
  const [weekOffset, setWeekOffset] = React.useState<number>(0);

  // Set initial weekOffset to show the week containing initialStartDate from browse page
  React.useEffect(function setInitialWeek(): void {
    if (initialStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffMs = initialStartDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      const targetOffset = Math.floor(diffDays / 7);
      if (targetOffset >= 0 && targetOffset <= 7) {
        setWeekOffset(targetOffset);
      }
    }
  }, []); // Only run once on mount -- initialStartDate won't change

  // Watch range.startDate for strip sync (replaces old handleFormDateChange callback)
  React.useEffect(function syncStripToRange(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((range.startDate.getTime() - today.getTime()) / 86400000);
    const targetWeek = Math.floor(diffDays / 7);
    const clamped = Math.max(0, Math.min(7, targetWeek));
    if (clamped !== weekOffset) {
      setWeekOffset(clamped);
    }
  }, [range.startDate]); // Only react to startDate changes

  // Compute weekStartDate string for API calls
  const weekStartDate = React.useMemo(function computeWeekStart(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() + weekOffset * 7 * 86400000);
    return start.getFullYear() + '-' + pad2(start.getMonth() + 1) + '-' + pad2(start.getDate());
  }, [weekOffset]);

  // Fetch vehicle detail (runs on vehicleId change only)
  React.useEffect(function loadVehicleDetail(): () => void {
    let cancelled = false;

    const fetchDetail = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const detail = await apiService.getVehicleDetail(vehicleId);
        if (!cancelled) {
          setVehicle(detail);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load vehicle details';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetail().catch(function onUnexpected(): void {
      if (!cancelled) {
        setLoading(false);
        setError('Unexpected error loading vehicle');
      }
    });

    return function cleanup(): void {
      cancelled = true;
    };
  }, [vehicleId, apiService]);

  // Fetch availability (runs on vehicleId + weekStartDate change)
  React.useEffect(function loadAvailability(): () => void {
    let cancelled = false;

    apiService.getVehicleAvailability(vehicleId, 7, weekStartDate)
      .then(function updateSlots(slots: IVehicleAvailabilitySlot[]): void {
        if (!cancelled) {
          setAvailabilitySlots(slots);
        }
      })
      .catch(function onError(): void {
        // Silently fail -- vehicle detail still shows, availability strip shows empty
      });

    return function cleanup(): void {
      cancelled = true;
    };
  }, [vehicleId, weekStartDate, apiService]);

  // Arrow navigation handlers
  const handlePrevWeek = React.useCallback(function onPrevWeek(): void {
    if (weekOffset > 0) setWeekOffset(weekOffset - 1);
  }, [weekOffset]);

  const handleNextWeek = React.useCallback(function onNextWeek(): void {
    if (weekOffset < 7) setWeekOffset(weekOffset + 1);
  }, [weekOffset]);

  // Strip slot click handler -- update range with clicked date and hour
  const handleStripSlotClick = React.useCallback(function onStripSlotClick(
    dayDate: Date, hour: number
  ): void {
    updateRange({ startDate: dayDate, startHour: hour, endDate: dayDate, endHour: hour >= 23 ? 23 : hour + 1 });
    setBookingSuccess(false);
  }, [updateRange]);

  // Selection summary callback for mobile sticky bottom bar
  const handleSelectionSummary = React.useCallback(function onSelectionSummary(summary: string): void {
    setSelectionLabel(summary);
  }, []);

  // Handlers
  const handleBookingComplete = React.useCallback(function onBookingComplete(_bookingId: number): void {
    setBookingSuccess(true);
    // Reset range to smart defaults
    const today = getToday();
    const nextHour = getNextFullHour();
    if (nextHour === 0) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRange({ startDate: tomorrow, startHour: 8, endDate: tomorrow, endHour: 9 });
    } else {
      setRange({
        startDate: today,
        startHour: nextHour,
        endDate: today,
        endHour: nextHour >= 23 ? 23 : nextHour + 1,
      });
    }
    // Dismiss bottom sheet on mobile after successful booking
    if (isMobile) {
      setIsBottomSheetOpen(false);
    }
    // Re-fetch availability to show new booking as booked
    apiService.getVehicleAvailability(vehicleId, 7, weekStartDate)
      .then(function updateSlots(slots: IVehicleAvailabilitySlot[]): void {
        setAvailabilitySlots(slots);
      })
      .catch(function onError(): void { /* silently fail */ });
  }, [vehicleId, weekStartDate, apiService, isMobile]);

  const handleConflict = React.useCallback(function onConflict(): void {
    // Re-fetch availability to refresh the strip
    apiService
      .getVehicleAvailability(vehicleId, 7, weekStartDate)
      .then(function updateSlots(slots: IVehicleAvailabilitySlot[]): void {
        setAvailabilitySlots(slots);
      })
      .catch(function onError(): void {
        // Silently fail - user will see stale availability
      });
  }, [vehicleId, weekStartDate, apiService]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.vehicleDetail}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading vehicle details..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !vehicle) {
    return (
      <div className={styles.vehicleDetail}>
        <div className={styles.backNav}>
          <IconButton
            iconProps={{ iconName: 'ChevronLeft' }}
            title="Back to results"
            ariaLabel="Back to results"
            onClick={onBack}
          />
          <Link onClick={onBack} className={styles.backLink}>
            Back to results
          </Link>
        </div>
        <MessageBar messageBarType={MessageBarType.error}>
          {error || 'Vehicle not found'}
        </MessageBar>
      </div>
    );
  }

  const vehicleName = vehicle.make + ' ' + vehicle.model + ' ' + String(vehicle.year);
  const vehicleTimezone = vehicle.locationTimezone || 'UTC';

  return (
    <div className={styles.vehicleDetail}>
      <div className={styles.vehicleDetailLayout}>
        {/* Left column: navigation, header, availability */}
        <div className={styles.leftColumn}>
          {/* Back navigation */}
          <div className={styles.backNav}>
            <IconButton
              iconProps={{ iconName: 'ChevronLeft' }}
              title="Back to results"
              ariaLabel="Back to results"
              onClick={onBack}
            />
            <Link onClick={onBack} className={styles.backLink}>
              Back to results
            </Link>
          </div>

          {/* Compact vehicle header */}
          <div className={styles.compactHeader}>
            {vehicle.photoUrl ? (
              <img src={vehicle.photoUrl} alt={vehicleName} className={styles.compactThumbnail} />
            ) : (
              <div className={styles.compactThumbnailPlaceholder}>
                <Icon iconName="Car" className={styles.compactPlaceholderIcon} />
              </div>
            )}
            <div className={styles.compactInfo}>
              <h2 className={styles.compactTitle}>{vehicleName}</h2>
              <div className={styles.compactSpecs}>
                <span>{vehicle.licensePlate}</span>
                <span>{vehicle.categoryName}</span>
                <span><Icon iconName="People" /> {vehicle.capacity} seats</span>
                <span>{vehicle.locationName}</span>
              </div>
            </div>
          </div>

          {/* Booking success message */}
          {bookingSuccess && (
            <MessageBar
              messageBarType={MessageBarType.success}
              isMultiline={false}
              className={styles.successBar}
            >
              Booking confirmed!{' '}
              <Link onClick={onNavigateToMyBookings}>View My Bookings</Link>
            </MessageBar>
          )}

          {/* Availability section */}
          <div className={styles.availabilitySection}>
            <AvailabilityStrip
              slots={availabilitySlots}
              timezone={vehicleTimezone}
              days={7}
              weekOffset={weekOffset}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onSlotClick={handleStripSlotClick}
              range={range}
              onRangeChange={updateRange}
            />
          </div>
        </div>

        {/* Right column: sticky booking form -- always visible on desktop */}
        <div className={styles.rightColumn}>
          <BookingForm
            vehicleId={vehicle.id}
            vehicleName={vehicleName}
            locationName={vehicle.locationName}
            locationTimezone={vehicleTimezone}
            apiService={apiService}
            onBookingComplete={handleBookingComplete}
            onConflict={handleConflict}
            onNavigateToVehicle={onNavigateToVehicle}
            range={range}
            onRangeChange={updateRange}
            availabilitySlots={availabilitySlots}
            onSelectionSummary={handleSelectionSummary}
          />
        </div>
      </div>

      {/* Mobile: sticky bottom bar + bottom sheet with booking form */}
      {isMobile && (
        <>
          <StickyBottomBar
            dateTimeLabel={selectionLabel || 'Select a time'}
            onBook={function openSheet(): void { setIsBottomSheetOpen(true); }}
          />
          <BottomSheet
            isOpen={isBottomSheetOpen}
            onDismiss={function closeSheet(): void { setIsBottomSheetOpen(false); }}
          >
            <BookingForm
              vehicleId={vehicle.id}
              vehicleName={vehicleName}
              locationName={vehicle.locationName}
              locationTimezone={vehicleTimezone}
              apiService={apiService}
              onBookingComplete={handleBookingComplete}
              onConflict={handleConflict}
              onNavigateToVehicle={onNavigateToVehicle}
              range={range}
              onRangeChange={updateRange}
              availabilitySlots={availabilitySlots}
              onSelectionSummary={handleSelectionSummary}
            />
          </BottomSheet>
        </>
      )}
    </div>
  );
};
