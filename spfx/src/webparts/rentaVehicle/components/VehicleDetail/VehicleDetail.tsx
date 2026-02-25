import * as React from 'react';
import { IconButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Icon } from '@fluentui/react/lib/Icon';
import { Link } from '@fluentui/react/lib/Link';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import styles from './VehicleDetail.module.scss';
import { ApiService } from '../../services/ApiService';
import { IAvailableVehicle, IVehicleAvailabilitySlot } from '../../models/IBooking';
import { AvailabilityStrip } from './AvailabilityStrip';
import { AvailabilityTimeline } from './AvailabilityTimeline';
import { BookingForm } from './BookingForm';

export interface IVehicleDetailProps {
  vehicleId: number;
  apiService: ApiService;
  currentUserId: string;
  onBack: () => void;
  onNavigateToMyBookings: () => void;
  onNavigateToVehicle?: (vehicleId: number) => void;
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

export const VehicleDetail: React.FC<IVehicleDetailProps> = ({
  vehicleId,
  apiService,
  currentUserId,
  onBack,
  onNavigateToMyBookings,
  onNavigateToVehicle,
}) => {
  const [vehicle, setVehicle] = React.useState<IAvailableVehicle | undefined>(undefined);
  const [availabilitySlots, setAvailabilitySlots] = React.useState<IVehicleAvailabilitySlot[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [bookingSuccess, setBookingSuccess] = React.useState<boolean>(false);
  const [availabilityView, setAvailabilityView] = React.useState<string>('week');

  // State for pre-filling BookingForm from timeline or strip slot click
  const [prefillDate, setPrefillDate] = React.useState<Date | undefined>(undefined);
  const [prefillStartHour, setPrefillStartHour] = React.useState<number | undefined>(undefined);

  // Week navigation state for AvailabilityStrip
  const [weekOffset, setWeekOffset] = React.useState<number>(0);

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

  // Strip slot click handler -- pre-fill booking form with date and hour
  const handleStripSlotClick = React.useCallback(function onStripSlotClick(
    dayDate: Date, hour: number
  ): void {
    setPrefillDate(dayDate);
    setPrefillStartHour(hour);
    setBookingSuccess(false);
  }, []);

  // Form date change handler (bidirectional sync -- form changes shift the strip)
  const handleFormDateChange = React.useCallback(function onFormDateChange(date: Date): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / 86400000);
    const targetWeek = Math.floor(diffDays / 7);
    setWeekOffset(Math.max(0, targetWeek));
  }, []);

  // Handlers
  const handleBookingComplete = React.useCallback(function onBookingComplete(_bookingId: number): void {
    setBookingSuccess(true);
    // Re-fetch availability to show new booking as booked
    apiService.getVehicleAvailability(vehicleId, 7, weekStartDate)
      .then(function updateSlots(slots: IVehicleAvailabilitySlot[]): void {
        setAvailabilitySlots(slots);
      })
      .catch(function onError(): void { /* silently fail */ });
  }, [vehicleId, weekStartDate, apiService]);

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

  const handleAvailabilityViewChange = React.useCallback(function onViewChange(item?: PivotItem): void {
    if (item && item.props.itemKey) {
      setAvailabilityView(item.props.itemKey);
    }
  }, []);

  const handleTimelineSlotClick = React.useCallback(function onSlotClick(
    _slotVehicleId: number,
    dateString: string,
    startHour: number
  ): void {
    // Parse date string (YYYY-MM-DD) and pre-fill the booking form
    const parts = dateString.split('-');
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    setPrefillDate(date);
    setPrefillStartHour(startHour);
    // Scroll to booking form
    setBookingSuccess(false);
  }, []);

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

      {/* Hero image */}
      <div className={styles.heroImage}>
        {vehicle.photoUrl ? (
          <img
            src={vehicle.photoUrl}
            alt={vehicleName}
            className={styles.heroImg}
          />
        ) : (
          <div className={styles.heroPlaceholder}>
            <Icon iconName="Car" className={styles.heroPlaceholderIcon} />
          </div>
        )}
      </div>

      {/* Vehicle title */}
      <h2 className={styles.vehicleTitle}>{vehicleName}</h2>

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

      {/* Specs section */}
      <div className={styles.specsSection}>
        <div className={styles.specsGrid}>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Make</span>
            <span className={styles.specValue}>{vehicle.make}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Model</span>
            <span className={styles.specValue}>{vehicle.model}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Year</span>
            <span className={styles.specValue}>{vehicle.year}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>License Plate</span>
            <span className={styles.specValue + ' ' + styles.specMono}>{vehicle.licensePlate}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Category</span>
            <span className={styles.specBadge}>{vehicle.categoryName}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Capacity</span>
            <span className={styles.specValue}>
              <Icon iconName="People" className={styles.specIcon} /> {vehicle.capacity} seats
            </span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Location</span>
            <span className={styles.specValue}>{vehicle.locationName}</span>
          </div>
          <div className={styles.specItem}>
            <span className={styles.specLabel}>Status</span>
            <span className={styles.specValue}>{vehicle.status}</span>
          </div>
        </div>
      </div>

      {/* Availability views toggle */}
      <Pivot
        selectedKey={availabilityView}
        onLinkClick={handleAvailabilityViewChange}
        headersOnly={false}
        className={styles.availabilityPivot}
      >
        <PivotItem headerText="Week View" itemKey="week">
          <AvailabilityStrip
            slots={availabilitySlots}
            timezone={vehicleTimezone}
            days={7}
            weekOffset={weekOffset}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onSlotClick={handleStripSlotClick}
          />
        </PivotItem>
        <PivotItem headerText="Day View" itemKey="day">
          <AvailabilityTimeline
            apiService={apiService}
            locationId={vehicle.locationId}
            locationTimezone={vehicleTimezone}
            currentUserId={currentUserId}
            onSlotClick={handleTimelineSlotClick}
          />
        </PivotItem>
      </Pivot>

      {/* Booking form */}
      {!bookingSuccess && (
        <BookingForm
          vehicleId={vehicle.id}
          vehicleName={vehicleName}
          locationName={vehicle.locationName}
          locationTimezone={vehicleTimezone}
          apiService={apiService}
          onBookingComplete={handleBookingComplete}
          onConflict={handleConflict}
          onNavigateToVehicle={onNavigateToVehicle}
          prefillDate={prefillDate}
          prefillStartHour={prefillStartHour}
          onFormDateChange={handleFormDateChange}
        />
      )}
    </div>
  );
};
