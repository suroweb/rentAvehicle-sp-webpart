import * as React from 'react';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './MyBookings.module.scss';
import { ApiService } from '../../services/ApiService';
import { IBooking } from '../../models/IBooking';
import { BookingEntry } from './BookingEntry';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';

export interface IMyBookingsProps {
  apiService: ApiService;
  onNavigateToBrowse: () => void;
}

type BookingTab = 'upcoming' | 'active' | 'past' | 'cancelled';

/**
 * Categorize bookings into tabs using explicit backend statuses.
 * Phase 4 provides explicit Active/Overdue statuses from check-out/expiry,
 * replacing the Phase 3 time-based Active derivation.
 */
function categorizeBookings(
  bookings: IBooking[]
): { upcoming: IBooking[]; active: IBooking[]; past: IBooking[]; cancelled: IBooking[] } {
  const now = new Date();
  const upcoming: IBooking[] = [];
  const active: IBooking[] = [];
  const past: IBooking[] = [];
  const cancelled: IBooking[] = [];

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i];

    if (b.status === 'Cancelled') {
      cancelled.push(b);
    } else if (b.status === 'Completed') {
      past.push(b);
    } else if (b.status === 'Active' || b.status === 'Overdue') {
      active.push(b);
    } else if (b.status === 'Confirmed') {
      const start = new Date(b.startTime);
      if (start > now) {
        upcoming.push(b);
      } else {
        // Confirmed but past start time -- awaiting check-out or auto-cancel
        upcoming.push(b);
      }
    } else {
      // Fallback: treat as past
      past.push(b);
    }
  }

  // Sort upcoming by soonest first
  upcoming.sort(function sortUpcoming(a: IBooking, bk: IBooking): number {
    return new Date(a.startTime).getTime() - new Date(bk.startTime).getTime();
  });

  // Sort active by ending soonest first
  active.sort(function sortActive(a: IBooking, bk: IBooking): number {
    return new Date(a.endTime).getTime() - new Date(bk.endTime).getTime();
  });

  // Sort past by most recent first
  past.sort(function sortPast(a: IBooking, bk: IBooking): number {
    return new Date(bk.endTime).getTime() - new Date(a.endTime).getTime();
  });

  // Sort cancelled by most recent first (using cancelledAt or startTime)
  cancelled.sort(function sortCancelled(a: IBooking, bk: IBooking): number {
    const aTime = a.cancelledAt ? new Date(a.cancelledAt).getTime() : new Date(a.startTime).getTime();
    const bTime = bk.cancelledAt ? new Date(bk.cancelledAt).getTime() : new Date(bk.startTime).getTime();
    return bTime - aTime;
  });

  return { upcoming: upcoming, active: active, past: past, cancelled: cancelled };
}

export const MyBookings: React.FC<IMyBookingsProps> = function MyBookings(props) {
  const apiService = props.apiService;
  const onNavigateToBrowse = props.onNavigateToBrowse;

  const [bookings, setBookings] = React.useState<IBooking[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = React.useState<BookingTab>('upcoming');
  const [cancellingId, setCancellingId] = React.useState<number | undefined>(undefined);
  const [confirmDialogBookingId, setConfirmDialogBookingId] = React.useState<number | undefined>(undefined);

  // Fetch bookings function (shared by initial load and refresh)
  const fetchBookings = React.useCallback(function fetchBookingsFn(): void {
    setLoading(true);
    setError(undefined);

    apiService.getMyBookings()
      .then(function onSuccess(data: IBooking[]): void {
        setBookings(data);
        setLoading(false);
      })
      .catch(function onError(err: unknown): void {
        const message = err instanceof Error ? err.message : 'Failed to load bookings';
        setError(message);
        setLoading(false);
      });
  }, [apiService]);

  // Fetch bookings on mount
  React.useEffect(function loadBookings(): void {
    fetchBookings();
  }, [fetchBookings]);

  // Refresh callback for BookingEntry lifecycle actions
  const handleRefresh = React.useCallback(function onRefresh(): void {
    fetchBookings();
  }, [fetchBookings]);

  // Categorize bookings
  const categorized = React.useMemo(function computeCategories(): {
    upcoming: IBooking[];
    active: IBooking[];
    past: IBooking[];
    cancelled: IBooking[];
  } {
    return categorizeBookings(bookings);
  }, [bookings]);

  // Tab change handler
  const handleTabChange = React.useCallback(function onTabChange(
    item?: PivotItem
  ): void {
    if (item && item.props.itemKey) {
      setActiveTab(item.props.itemKey as BookingTab);
    }
  },
  []);

  // Cancel flow: open dialog
  const handleCancelClick = React.useCallback(function onCancelClick(
    bookingId: number
  ): void {
    setConfirmDialogBookingId(bookingId);
  },
  []);

  // Cancel flow: confirm cancellation
  const handleCancelConfirm = React.useCallback(
    function onCancelConfirm(): void {
      if (confirmDialogBookingId === undefined) return;

      const bookingId = confirmDialogBookingId;
      setConfirmDialogBookingId(undefined);
      setCancellingId(bookingId);

      // --- Cancel error simulation via ?simulateError=cancelBooking ---
      let simulateCancelError = false;
      try {
        simulateCancelError = new URLSearchParams(window.location.search).get('simulateError') === 'cancelBooking';
      } catch { /* ignore */ }

      if (simulateCancelError) {
        setTimeout(function onSimulatedError(): void {
          setCancellingId(undefined);
          setError('API request failed: 500 Internal Server Error - Unable to cancel booking. Please try again later.');
        }, 1200);
        return;
      }
      // --- End cancel error simulation ---

      apiService
        .cancelBooking(bookingId)
        .then(function onCancelSuccess(): Promise<IBooking[]> {
          // Re-fetch bookings to update lists
          return apiService.getMyBookings();
        })
        .then(function onRefreshSuccess(data: IBooking[]): void {
          setBookings(data);
          setCancellingId(undefined);
        })
        .catch(function onCancelError(err: unknown): void {
          const message =
            err instanceof Error ? err.message : 'Failed to cancel booking';
          setError(message);
          setCancellingId(undefined);
        });
    },
    [confirmDialogBookingId, apiService]
  );

  // Cancel flow: dismiss dialog
  const handleCancelDismiss = React.useCallback(function onCancelDismiss(): void {
    setConfirmDialogBookingId(undefined);
  }, []);

  // Check if all tabs are empty (no bookings at all)
  const totalBookings = bookings.length;

  // Loading state
  if (loading) {
    return (
      <div className={styles.myBookings}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading bookings..." />
        </div>
      </div>
    );
  }

  // Global empty state (no bookings at all)
  if (totalBookings === 0 && !error) {
    return (
      <div className={styles.myBookings}>
        <div className={styles.header}>
          <h2 className={styles.pageTitle}>My Bookings</h2>
        </div>
        <div className={styles.emptyStateGlobal}>
          <Icon iconName="Calendar" className={styles.emptyStateIcon} />
          <h3 className={styles.emptyStateTitle}>No bookings yet</h3>
          <p className={styles.emptyStateText}>
            You have not made any vehicle bookings. Browse available vehicles to
            get started.
          </p>
          <PrimaryButton
            text="Book a Vehicle"
            iconProps={{ iconName: 'Car' }}
            onClick={onNavigateToBrowse}
          />
        </div>
      </div>
    );
  }

  // Render tab content
  const renderBookingList = function renderBookingListFn(
    list: IBooking[],
    tabName: string,
    showCancel: boolean
  ): React.ReactElement {
    if (list.length === 0) {
      return (
        <div className={styles.emptyStateTab}>
          {tabName === 'cancelled' ? 'No cancelled bookings' : ('No ' + tabName + ' bookings')}
        </div>
      );
    }

    return (
      <div className={styles.bookingList}>
        {list.map(function renderEntry(booking: IBooking): React.ReactElement {
          return (
            <BookingEntry
              key={booking.id}
              booking={booking}
              apiService={apiService}
              onCancel={showCancel ? handleCancelClick : undefined}
              onRefresh={handleRefresh}
              showCancel={showCancel}
              isCancelling={cancellingId === booking.id}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.myBookings}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>My Bookings</h2>
      </div>

      {error && (
        <div className={styles.errorBar}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={function dismissError(): void {
              setError(undefined);
            }}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        </div>
      )}

      <Pivot
        selectedKey={activeTab}
        onLinkClick={handleTabChange}
        headersOnly={false}
      >
        <PivotItem
          headerText={'Upcoming (' + String(categorized.upcoming.length) + ')'}
          itemKey="upcoming"
        >
          <div className={styles.tabContent}>
            {renderBookingList(categorized.upcoming, 'upcoming', true)}
          </div>
        </PivotItem>
        <PivotItem
          headerText={'Active (' + String(categorized.active.length) + ')'}
          itemKey="active"
        >
          <div className={styles.tabContent}>
            {renderBookingList(categorized.active, 'active', false)}
          </div>
        </PivotItem>
        <PivotItem
          headerText={'Past (' + String(categorized.past.length) + ')'}
          itemKey="past"
        >
          <div className={styles.tabContent}>
            {renderBookingList(categorized.past, 'past', false)}
          </div>
        </PivotItem>
        <PivotItem
          headerText={'Cancelled (' + String(categorized.cancelled.length) + ')'}
          itemKey="cancelled"
        >
          <div className={styles.tabContent}>
            {renderBookingList(categorized.cancelled, 'cancelled', false)}
          </div>
        </PivotItem>
      </Pivot>

      {/* Confirm cancel dialog */}
      <ConfirmDialog
        hidden={confirmDialogBookingId === undefined}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancelConfirm}
        onDismiss={handleCancelDismiss}
      />
    </div>
  );
};
