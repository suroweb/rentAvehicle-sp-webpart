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

export interface IVehicleDetailProps {
  vehicleId: number;
  apiService: ApiService;
  onBack: () => void;
  onNavigateToMyBookings: () => void;
}

export const VehicleDetail: React.FC<IVehicleDetailProps> = ({
  vehicleId,
  apiService,
  onBack,
  onNavigateToMyBookings,
}) => {
  const [vehicle, setVehicle] = React.useState<IAvailableVehicle | undefined>(undefined);
  const [availabilitySlots, setAvailabilitySlots] = React.useState<IVehicleAvailabilitySlot[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [bookingSuccess, setBookingSuccess] = React.useState<boolean>(false);

  // Fetch vehicle detail and availability in parallel
  React.useEffect(function loadVehicleData(): () => void {
    let cancelled = false;

    const fetchData = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const [detail, slots] = await Promise.all([
          apiService.getVehicleDetail(vehicleId),
          apiService.getVehicleAvailability(vehicleId, 7),
        ]);

        if (!cancelled) {
          setVehicle(detail);
          setAvailabilitySlots(slots);
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

    fetchData().catch(function onUnexpected(): void {
      if (!cancelled) {
        setLoading(false);
        setError('Unexpected error loading vehicle');
      }
    });

    return function cleanup(): void {
      cancelled = true;
    };
  }, [vehicleId, apiService]);

  // Handlers
  const handleBookingComplete = React.useCallback(function onBookingComplete(_bookingId: number): void {
    setBookingSuccess(true);
  }, []);

  const handleConflict = React.useCallback(function onConflict(): void {
    // Re-fetch availability to refresh the strip
    apiService
      .getVehicleAvailability(vehicleId, 7)
      .then(function updateSlots(slots: IVehicleAvailabilitySlot[]): void {
        setAvailabilitySlots(slots);
      })
      .catch(function onError(): void {
        // Silently fail - user will see stale availability
      });
  }, [vehicleId, apiService]);

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

      {/* Availability strip */}
      <AvailabilityStrip
        slots={availabilitySlots}
        timezone={vehicleTimezone}
        days={7}
      />

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
        />
      )}
    </div>
  );
};
