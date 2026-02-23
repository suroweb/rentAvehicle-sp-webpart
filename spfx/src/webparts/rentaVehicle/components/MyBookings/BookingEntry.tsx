import * as React from 'react';
import { DefaultButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import styles from './MyBookings.module.scss';
import { IBooking } from '../../models/IBooking';
import { useTimezone } from '../../hooks/useTimezone';

export interface IBookingEntryProps {
  booking: IBooking;
  onCancel?: (bookingId: number) => void;
  showCancel?: boolean;
  isCancelling?: boolean;
}

export const BookingEntry: React.FC<IBookingEntryProps> = ({
  booking,
  onCancel,
  showCancel,
  isCancelling,
}) => {
  const tz = useTimezone(booking.locationTimezone || 'UTC');

  const handleCancelClick = React.useCallback(function onCancelClick(): void {
    if (onCancel) {
      onCancel(booking.id);
    }
  }, [onCancel, booking.id]);

  const vehicleName = booking.vehicleMake + ' ' + booking.vehicleModel;
  const formattedStart = tz.formatDateTime(booking.startTime);
  const formattedEnd = tz.formatDateTime(booking.endTime);

  return (
    <div className={styles.bookingEntry}>
      {/* Photo thumbnail */}
      <div className={styles.entryPhoto}>
        {booking.vehiclePhotoUrl ? (
          <img
            src={booking.vehiclePhotoUrl}
            alt={vehicleName}
            className={styles.entryPhotoImg}
          />
        ) : (
          <div className={styles.entryPhotoPlaceholder}>
            <Icon iconName="Car" className={styles.entryPhotoIcon} />
          </div>
        )}
      </div>

      {/* Booking info */}
      <div className={styles.entryInfo}>
        <h3 className={styles.entryTitle}>{vehicleName}</h3>
        <span className={styles.entryPlate}>{booking.vehicleLicensePlate}</span>
        <span className={styles.entryCategoryBadge}>{booking.vehicleCategoryName}</span>

        <div className={styles.entryDatetime}>
          {formattedStart} - {formattedEnd} ({tz.timezoneAbbr})
        </div>

        <div className={styles.entryLocation}>
          <Icon iconName="MapPin" className={styles.entryLocationIcon} />
          {booking.locationName}
        </div>

        {booking.status === 'Cancelled' && (
          <span className={styles.entryCancelledBadge}>Cancelled</span>
        )}
      </div>

      {/* Cancel button */}
      {showCancel && onCancel && (
        <div className={styles.entryCancelAction}>
          {isCancelling ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            <DefaultButton
              text="Cancel"
              iconProps={{ iconName: 'Cancel' }}
              onClick={handleCancelClick}
              className={styles.cancelButton}
            />
          )}
        </div>
      )}
    </div>
  );
};
