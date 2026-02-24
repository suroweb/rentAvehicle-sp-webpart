import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './MyBookings.module.scss';
import { IBooking } from '../../models/IBooking';
import { ApiService } from '../../services/ApiService';
import { useTimezone } from '../../hooks/useTimezone';

export interface IBookingEntryProps {
  booking: IBooking;
  apiService: ApiService;
  onCancel?: (bookingId: number) => void;
  onRefresh: () => void;
  showCancel?: boolean;
  isCancelling?: boolean;
}

/**
 * Check if current time is within the check-out window:
 * startTime - 30 minutes <= now <= startTime + 60 minutes
 */
function isCheckOutWindowOpen(startTime: string): boolean {
  const now = new Date().getTime();
  const start = new Date(startTime).getTime();
  const windowStart = start - 30 * 60 * 1000; // 30 min before
  const windowEnd = start + 60 * 60 * 1000;   // 60 min after
  return now >= windowStart && now <= windowEnd;
}

export const BookingEntry: React.FC<IBookingEntryProps> = function BookingEntry(props) {
  const booking = props.booking;
  const apiService = props.apiService;
  const onCancel = props.onCancel;
  const onRefresh = props.onRefresh;
  const showCancel = props.showCancel;
  const isCancelling = props.isCancelling;

  const tz = useTimezone(booking.locationTimezone || 'UTC');

  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);

  const handleCancelClick = React.useCallback(function onCancelClick(): void {
    if (onCancel) {
      onCancel(booking.id);
    }
  }, [onCancel, booking.id]);

  const handleCheckOut = React.useCallback(function onCheckOut(): void {
    setActionLoading(true);
    setActionError(undefined);

    apiService.checkOutBooking(booking.id)
      .then(function onSuccess(): void {
        setActionLoading(false);
        onRefresh();
      })
      .catch(function onError(err: unknown): void {
        setActionLoading(false);
        const message = err instanceof Error ? err.message : 'Check-out failed';
        setActionError(message);
      });
  }, [booking.id, apiService, onRefresh]);

  const handleCheckIn = React.useCallback(function onCheckIn(): void {
    setActionLoading(true);
    setActionError(undefined);

    apiService.checkInBooking(booking.id)
      .then(function onSuccess(): void {
        setActionLoading(false);
        onRefresh();
      })
      .catch(function onError(err: unknown): void {
        setActionLoading(false);
        const message = err instanceof Error ? err.message : 'Return failed';
        setActionError(message);
      });
  }, [booking.id, apiService, onRefresh]);

  const vehicleName = booking.vehicleMake + ' ' + booking.vehicleModel;
  const formattedStart = tz.formatDateTime(booking.startTime);
  const formattedEnd = tz.formatDateTime(booking.endTime);

  // Determine which lifecycle buttons to show
  const showCheckOut = booking.status === 'Confirmed' && isCheckOutWindowOpen(booking.startTime);
  const showReturn = booking.status === 'Active' || booking.status === 'Overdue';
  const isOverdue = booking.status === 'Overdue';
  const isCancelledByAdmin = booking.status === 'Cancelled' && booking.cancelReason;

  // Status badge
  let statusBadgeClass = '';
  let statusLabel = '';
  if (booking.status === 'Overdue') {
    statusBadgeClass = styles.entryOverdueBadge;
    statusLabel = 'Overdue';
  } else if (booking.status === 'Active') {
    statusBadgeClass = styles.entryActiveBadge;
    statusLabel = 'Checked Out';
  } else if (booking.status === 'Confirmed') {
    statusBadgeClass = styles.entryConfirmedBadge;
    statusLabel = 'Confirmed';
  } else if (booking.status === 'Completed') {
    statusBadgeClass = styles.entryCompletedBadge;
    statusLabel = 'Completed';
  } else if (booking.status === 'Cancelled') {
    statusBadgeClass = styles.entryCancelledBadge;
    statusLabel = isCancelledByAdmin ? 'Cancelled by Admin' : 'Cancelled';
  }

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

        {/* Status badge */}
        {statusLabel && (
          <span className={statusBadgeClass}>{statusLabel}</span>
        )}

        {/* Overdue warning */}
        {isOverdue && (
          <div className={styles.overdueWarning}>
            <MessageBar messageBarType={MessageBarType.severeWarning} isMultiline={false}>
              This vehicle is overdue for return. Please return it immediately.
            </MessageBar>
          </div>
        )}

        {/* Admin cancel reason */}
        {isCancelledByAdmin && (
          <div className={styles.adminCancelReason}>
            <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
              Reason: {booking.cancelReason}
            </MessageBar>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div className={styles.actionError}>
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              onDismiss={function dismissActionError(): void { setActionError(undefined); }}
              dismissButtonAriaLabel="Close"
            >
              {actionError}
            </MessageBar>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={styles.entryActions}>
        {/* Check Out button */}
        {showCheckOut && (
          actionLoading ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            <PrimaryButton
              text="Check Out"
              iconProps={{ iconName: 'BoxCheckmarkSolid' }}
              onClick={handleCheckOut}
            />
          )
        )}

        {/* Return button */}
        {showReturn && (
          actionLoading ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            <PrimaryButton
              text="Return Vehicle"
              iconProps={{ iconName: 'ReturnKey' }}
              onClick={handleCheckIn}
            />
          )
        )}

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
    </div>
  );
};
