import * as React from 'react';
import {
  DetailsList,
  IColumn,
  SelectionMode,
  DetailsListLayoutMode,
} from '@fluentui/react/lib/DetailsList';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { DefaultButton } from '@fluentui/react/lib/Button';
import styles from './TeamBookings.module.scss';
import { ApiService } from '../../services/ApiService';
import { ITeamBooking } from '../../models/IReport';

export interface ITeamBookingsProps {
  apiService: ApiService;
}

const BOOKING_STATUS_STYLES: Record<string, string> = {
  Confirmed: styles.statusConfirmed,
  Active: styles.statusActive,
  Overdue: styles.statusOverdue,
};

/**
 * Inline timezone-aware date formatter for table cells.
 * Each booking may have a different location timezone.
 */
function formatBookingDate(utcDateStr: string, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date(utcDateStr));
  } catch (e) {
    // Fallback: show raw date
    return e ? new Date(utcDateStr).toLocaleString() : new Date(utcDateStr).toLocaleString();
  }
}

export const TeamBookings: React.FC<ITeamBookingsProps> = function TeamBookings(props) {
  const apiService = props.apiService;

  const [bookings, setBookings] = React.useState<ITeamBooking[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortColumn, setSortColumn] = React.useState<string>('startTime');
  const [sortDescending, setSortDescending] = React.useState<boolean>(false);

  // Fetch team bookings
  const fetchTeamBookings = React.useCallback(function fetchTeamBookingsFn(): void {
    setLoading(true);
    setError(null);

    apiService.getTeamBookings()
      .then(function onSuccess(data: ITeamBooking[]): void {
        setBookings(data);
        setLoading(false);
      })
      .catch(function onError(err: unknown): void {
        const message = err instanceof Error ? err.message : 'Failed to load team bookings';
        setError(message);
        setLoading(false);
      });
  }, [apiService]);

  // Fetch on mount
  React.useEffect(function loadTeamBookings(): void {
    fetchTeamBookings();
  }, [fetchTeamBookings]);

  // Retry handler
  const handleRetry = React.useCallback(function onRetry(): void {
    fetchTeamBookings();
  }, [fetchTeamBookings]);

  // Sorting
  const onColumnClick = React.useCallback(function onColClick(
    _ev?: React.MouseEvent<HTMLElement>,
    column?: IColumn
  ): void {
    if (!column || !column.fieldName) return;
    const newDescending = sortColumn === column.fieldName ? !sortDescending : false;
    setSortColumn(column.fieldName);
    setSortDescending(newDescending);
  }, [sortColumn, sortDescending]);

  const sortedItems = React.useMemo(function computeSorted(): ITeamBooking[] {
    if (!sortColumn) return bookings;

    const sorted = bookings.slice();
    sorted.sort(function compareBookings(a: ITeamBooking, b: ITeamBooking): number {
      const aVal = (a as unknown as Record<string, unknown>)[sortColumn];
      const bVal = (b as unknown as Record<string, unknown>)[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal) > String(bVal) ? 1 : -1;
      }

      return sortDescending ? -comparison : comparison;
    });
    return sorted;
  }, [bookings, sortColumn, sortDescending]);

  // Column definitions
  const columns: IColumn[] = React.useMemo(function buildColumns(): IColumn[] {
    return [
      {
        key: 'employee',
        name: 'Employee',
        fieldName: 'userDisplayName',
        minWidth: 100,
        maxWidth: 160,
        isResizable: true,
        isSorted: sortColumn === 'userDisplayName',
        isSortedDescending: sortColumn === 'userDisplayName' ? sortDescending : false,
        onColumnClick: onColumnClick,
      },
      {
        key: 'vehicle',
        name: 'Vehicle',
        fieldName: 'vehicleMake',
        minWidth: 100,
        maxWidth: 160,
        isResizable: true,
        isSorted: sortColumn === 'vehicleMake',
        isSortedDescending: sortColumn === 'vehicleMake' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderVehicle(item: ITeamBooking): React.ReactElement {
          return React.createElement('span', null, item.vehicleMake + ' ' + item.vehicleModel);
        },
      },
      {
        key: 'licensePlate',
        name: 'License Plate',
        fieldName: 'vehicleLicensePlate',
        minWidth: 80,
        maxWidth: 120,
        isResizable: true,
        isSorted: sortColumn === 'vehicleLicensePlate',
        isSortedDescending: sortColumn === 'vehicleLicensePlate' ? sortDescending : false,
        onColumnClick: onColumnClick,
      },
      {
        key: 'location',
        name: 'Location',
        fieldName: 'locationName',
        minWidth: 80,
        maxWidth: 140,
        isResizable: true,
        isSorted: sortColumn === 'locationName',
        isSortedDescending: sortColumn === 'locationName' ? sortDescending : false,
        onColumnClick: onColumnClick,
      },
      {
        key: 'startTime',
        name: 'Pickup',
        fieldName: 'startTime',
        minWidth: 120,
        maxWidth: 170,
        isResizable: true,
        isSorted: sortColumn === 'startTime',
        isSortedDescending: sortColumn === 'startTime' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderStart(item: ITeamBooking): React.ReactElement {
          return React.createElement('span', null, formatBookingDate(item.startTime, item.locationTimezone));
        },
      },
      {
        key: 'endTime',
        name: 'Return',
        fieldName: 'endTime',
        minWidth: 120,
        maxWidth: 170,
        isResizable: true,
        isSorted: sortColumn === 'endTime',
        isSortedDescending: sortColumn === 'endTime' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderEnd(item: ITeamBooking): React.ReactElement {
          return React.createElement('span', null, formatBookingDate(item.endTime, item.locationTimezone));
        },
      },
      {
        key: 'status',
        name: 'Status',
        fieldName: 'status',
        minWidth: 80,
        maxWidth: 110,
        isResizable: true,
        isSorted: sortColumn === 'status',
        isSortedDescending: sortColumn === 'status' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderStatus(item: ITeamBooking): React.ReactElement {
          const badgeClass = BOOKING_STATUS_STYLES[item.status] || '';
          return React.createElement(
            'span',
            { className: styles.statusBadge + ' ' + badgeClass },
            item.status
          );
        },
      },
    ];
  }, [sortColumn, sortDescending, onColumnClick]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.teamBookings}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading team bookings..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.teamBookings}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>{"My Team's Bookings"}</h2>
        <p className={styles.subtitle}>Current and upcoming vehicle bookings for your direct reports</p>
      </div>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          actions={
            React.createElement(
              'div',
              null,
              React.createElement(DefaultButton, {
                text: 'Retry',
                onClick: handleRetry,
              })
            )
          }
        >
          {error}
        </MessageBar>
      )}

      {!error && bookings.length === 0 && (
        <MessageBar
          messageBarType={MessageBarType.info}
          isMultiline={false}
        >
          No active bookings found for your team members.
        </MessageBar>
      )}

      {bookings.length > 0 && (
        <div className={styles.tableContainer}>
          <DetailsList
            items={sortedItems}
            columns={columns}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            isHeaderVisible={true}
          />
        </div>
      )}
    </div>
  );
};
