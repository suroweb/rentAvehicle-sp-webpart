import * as React from 'react';
import {
  DetailsList,
  IColumn,
  SelectionMode,
  DetailsListLayoutMode,
} from '@fluentui/react/lib/DetailsList';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { TextField } from '@fluentui/react/lib/TextField';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import {
  Dialog,
  DialogType,
  DialogFooter,
} from '@fluentui/react/lib/Dialog';
import styles from './AllBookings.module.scss';
import { ApiService } from '../../services/ApiService';
import { IBooking } from '../../models/IBooking';
import { ILocation } from '../../models/ILocation';

export interface IAllBookingsProps {
  apiService: ApiService;
  locations: ILocation[];
}

interface IBookingFilters {
  locationId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  employeeSearch?: string;
}

interface ICancelDialogState {
  booking: IBooking | undefined;
  reason: string;
  error: string | undefined;
  submitting: boolean;
}

const STATUS_OPTIONS: IDropdownOption[] = [
  { key: '', text: 'All Statuses' },
  { key: 'Confirmed', text: 'Confirmed' },
  { key: 'Active', text: 'Active' },
  { key: 'Overdue', text: 'Overdue' },
  { key: 'Completed', text: 'Completed' },
  { key: 'Cancelled', text: 'Cancelled' },
];

const BOOKING_STATUS_STYLES: Record<string, string> = {
  Confirmed: styles.statusConfirmed,
  Active: styles.statusActive,
  Overdue: styles.statusOverdue,
  Completed: styles.statusCompleted,
  Cancelled: styles.statusCancelled,
};

/** Pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/** Format a Date to YYYY-MM-DD for API filters. */
function formatDateForApi(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * Inline timezone-aware date formatter for table cells.
 * Returns formatted date string in the booking's location timezone.
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

const defaultCancelState: ICancelDialogState = {
  booking: undefined,
  reason: '',
  error: undefined,
  submitting: false,
};

export const AllBookings: React.FC<IAllBookingsProps> = function AllBookings(props) {
  const apiService = props.apiService;
  const locations = props.locations;

  const [bookings, setBookings] = React.useState<IBooking[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [filters, setFilters] = React.useState<IBookingFilters>({});
  const [sortColumn, setSortColumn] = React.useState<string>('startTime');
  const [sortDescending, setSortDescending] = React.useState<boolean>(true);
  const [cancelDialog, setCancelDialog] = React.useState<ICancelDialogState>(defaultCancelState);

  const searchTimerRef = React.useRef<number | undefined>(undefined);

  // Location dropdown options
  const locationOptions = React.useMemo(function buildLocationOptions(): IDropdownOption[] {
    const options: IDropdownOption[] = [{ key: '', text: 'All Locations' }];
    for (let i = 0; i < locations.length; i++) {
      options.push({ key: String(locations[i].id), text: locations[i].name });
    }
    return options;
  }, [locations]);

  // Fetch bookings from API
  const fetchBookings = React.useCallback(function fetchBookingsFn(currentFilters: IBookingFilters): void {
    setLoading(true);
    setError(undefined);

    const apiFilters: {
      locationId?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      employeeSearch?: string;
    } = {};

    if (currentFilters.locationId !== undefined) {
      apiFilters.locationId = currentFilters.locationId;
    }
    if (currentFilters.status) {
      apiFilters.status = currentFilters.status;
    }
    if (currentFilters.dateFrom) {
      apiFilters.dateFrom = formatDateForApi(currentFilters.dateFrom);
    }
    if (currentFilters.dateTo) {
      apiFilters.dateTo = formatDateForApi(currentFilters.dateTo);
    }
    if (currentFilters.employeeSearch) {
      apiFilters.employeeSearch = currentFilters.employeeSearch;
    }

    apiService.getAllBookings(apiFilters)
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

  // Initial load
  React.useEffect(function initialLoad(): void {
    fetchBookings(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup search timer on unmount
  React.useEffect(function cleanup(): () => void {
    return function cleanupFn(): void {
      if (searchTimerRef.current !== undefined) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Filter change handlers
  const handleLocationChange = React.useCallback(function onLocationChange(
    _event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ): void {
    if (!option) return;
    const locationId = option.key === '' ? undefined : Number(option.key);
    setFilters(function updateFilters(prev: IBookingFilters): IBookingFilters {
      return {
        locationId: locationId,
        status: prev.status,
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo,
        employeeSearch: prev.employeeSearch,
      };
    });
  }, []);

  const handleStatusChange = React.useCallback(function onStatusChange(
    _event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ): void {
    if (!option) return;
    const status = option.key === '' ? undefined : String(option.key);
    setFilters(function updateFilters(prev: IBookingFilters): IBookingFilters {
      return {
        locationId: prev.locationId,
        status: status,
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo,
        employeeSearch: prev.employeeSearch,
      };
    });
  }, []);

  const handleDateFromChange = React.useCallback(function onDateFromChange(
    date: Date | null | undefined
  ): void {
    setFilters(function updateFilters(prev: IBookingFilters): IBookingFilters {
      return {
        locationId: prev.locationId,
        status: prev.status,
        dateFrom: date || undefined,
        dateTo: prev.dateTo,
        employeeSearch: prev.employeeSearch,
      };
    });
  }, []);

  const handleDateToChange = React.useCallback(function onDateToChange(
    date: Date | null | undefined
  ): void {
    setFilters(function updateFilters(prev: IBookingFilters): IBookingFilters {
      return {
        locationId: prev.locationId,
        status: prev.status,
        dateFrom: prev.dateFrom,
        dateTo: date || undefined,
        employeeSearch: prev.employeeSearch,
      };
    });
  }, []);

  const handleEmployeeSearchChange = React.useCallback(function onEmployeeSearch(
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ): void {
    if (searchTimerRef.current !== undefined) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(function doSearch(): void {
      const search = newValue && newValue.trim() ? newValue.trim() : undefined;
      setFilters(function updateFilters(prev: IBookingFilters): IBookingFilters {
        return {
          locationId: prev.locationId,
          status: prev.status,
          dateFrom: prev.dateFrom,
          dateTo: prev.dateTo,
          employeeSearch: search,
        };
      });
    }, 300);
  }, []);

  // Apply filters
  const handleApplyFilters = React.useCallback(function onApply(): void {
    fetchBookings(filters);
  }, [filters, fetchBookings]);

  // Clear filters
  const handleClearFilters = React.useCallback(function onClear(): void {
    const emptyFilters: IBookingFilters = {};
    setFilters(emptyFilters);
    fetchBookings(emptyFilters);
  }, [fetchBookings]);

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

  const sortedItems = React.useMemo(function computeSorted(): IBooking[] {
    if (!sortColumn) return bookings;

    const sorted = bookings.slice();
    sorted.sort(function compareBookings(a: IBooking, b: IBooking): number {
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

  // Cancel dialog handlers
  const handleCancelClick = React.useCallback(function onCancelClick(booking: IBooking): void {
    setCancelDialog({
      booking: booking,
      reason: '',
      error: undefined,
      submitting: false,
    });
  }, []);

  const handleCancelReasonChange = React.useCallback(function onReasonChange(
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ): void {
    setCancelDialog(function updateDialog(prev: ICancelDialogState): ICancelDialogState {
      return {
        booking: prev.booking,
        reason: newValue || '',
        error: prev.error,
        submitting: prev.submitting,
      };
    });
  }, []);

  const handleCancelConfirm = React.useCallback(function onConfirmCancel(): void {
    if (!cancelDialog.booking) return;
    const reason = cancelDialog.reason.trim();
    if (!reason) return;

    const bookingId = cancelDialog.booking.id;
    setCancelDialog(function updateDialog(prev: ICancelDialogState): ICancelDialogState {
      return {
        booking: prev.booking,
        reason: prev.reason,
        error: undefined,
        submitting: true,
      };
    });

    apiService.adminCancelBooking(bookingId, reason)
      .then(function onSuccess(): void {
        setCancelDialog(defaultCancelState);
        fetchBookings(filters);
      })
      .catch(function onError(err: unknown): void {
        const message = err instanceof Error ? err.message : 'Failed to cancel booking';
        setCancelDialog(function updateDialog(prev: ICancelDialogState): ICancelDialogState {
          return {
            booking: prev.booking,
            reason: prev.reason,
            error: message,
            submitting: false,
          };
        });
      });
  }, [cancelDialog.booking, cancelDialog.reason, apiService, filters, fetchBookings]);

  const handleCancelDismiss = React.useCallback(function onDismiss(): void {
    if (!cancelDialog.submitting) {
      setCancelDialog(defaultCancelState);
    }
  }, [cancelDialog.submitting]);

  // Build column definitions
  const buildColumn = function buildColumnFn(
    key: string,
    name: string,
    fieldName: string,
    minWidth: number,
    maxWidth: number,
    sortable: boolean
  ): IColumn {
    return {
      key: key,
      name: name,
      fieldName: fieldName,
      minWidth: minWidth,
      maxWidth: maxWidth,
      isResizable: true,
      isSorted: sortColumn === fieldName,
      isSortedDescending: sortColumn === fieldName ? sortDescending : false,
      onColumnClick: sortable ? onColumnClick : undefined,
    };
  };

  const columns: IColumn[] = React.useMemo(function buildColumns(): IColumn[] {
    return [
      buildColumn('id', 'ID', 'id', 40, 60, true),
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
        onRender: function renderVehicle(item: IBooking): React.ReactElement {
          return React.createElement('span', null, item.vehicleMake + ' ' + item.vehicleModel);
        },
      },
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
        onRender: function renderEmployee(item: IBooking): React.ReactElement {
          return React.createElement('span', null, item.userDisplayName || item.userEmail);
        },
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
        name: 'Start',
        fieldName: 'startTime',
        minWidth: 120,
        maxWidth: 170,
        isResizable: true,
        isSorted: sortColumn === 'startTime',
        isSortedDescending: sortColumn === 'startTime' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderStart(item: IBooking): React.ReactElement {
          return React.createElement('span', null, formatBookingDate(item.startTime, item.locationTimezone));
        },
      },
      {
        key: 'endTime',
        name: 'End',
        fieldName: 'endTime',
        minWidth: 120,
        maxWidth: 170,
        isResizable: true,
        isSorted: sortColumn === 'endTime',
        isSortedDescending: sortColumn === 'endTime' ? sortDescending : false,
        onColumnClick: onColumnClick,
        onRender: function renderEnd(item: IBooking): React.ReactElement {
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
        onRender: function renderStatus(item: IBooking): React.ReactElement {
          const badgeClass = BOOKING_STATUS_STYLES[item.status] || '';
          return React.createElement(
            'span',
            { className: styles.statusBadge + ' ' + badgeClass },
            item.status
          );
        },
      },
      {
        key: 'actions',
        name: '',
        fieldName: '',
        minWidth: 80,
        maxWidth: 100,
        isResizable: false,
        onRender: function renderActions(item: IBooking): React.ReactElement | null {
          const canCancel = item.status === 'Confirmed' ||
            item.status === 'Active' ||
            item.status === 'Overdue';
          if (!canCancel) return null;
          return React.createElement(DefaultButton, {
            text: 'Cancel',
            onClick: function onClick(): void { handleCancelClick(item); },
            styles: { root: { minWidth: 60, height: 28, padding: '0 8px' } },
          });
        },
      },
    ];
  }, [sortColumn, sortDescending, onColumnClick, handleCancelClick]);

  // Cancel dialog content props
  const cancelDialogContentProps = React.useMemo(function buildDialogContent(): {
    type: typeof DialogType.normal;
    title: string;
    subText: string;
  } {
    const booking = cancelDialog.booking;
    const subText = booking
      ? 'Cancel booking #' + String(booking.id) + ' for ' + booking.vehicleMake + ' ' + booking.vehicleModel + ' by ' + (booking.userDisplayName || booking.userEmail) + '?'
      : '';
    return {
      type: DialogType.normal,
      title: 'Cancel Booking',
      subText: subText,
    };
  }, [cancelDialog.booking]);

  const cancelDialogModalProps = React.useMemo(function buildModalProps(): {
    isBlocking: boolean;
    styles: { main: { maxWidth: number } };
  } {
    return {
      isBlocking: true,
      styles: { main: { maxWidth: 480 } },
    };
  }, []);

  const isReasonEmpty = !cancelDialog.reason || !cancelDialog.reason.trim();

  // Loading state
  if (loading && bookings.length === 0) {
    return (
      <div className={styles.allBookings}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading bookings..." />
        </div>
      </div>
    );
  }

  const dropdownStyles = { dropdown: { width: 180 } };
  const datePickerStyles = { root: { width: 150 } };

  return (
    <div className={styles.allBookings}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>All Bookings</h2>
      </div>

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

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <Dropdown
          placeholder="All Locations"
          selectedKey={filters.locationId !== undefined ? String(filters.locationId) : ''}
          options={locationOptions}
          onChange={handleLocationChange}
          styles={dropdownStyles}
          label="Location"
        />
        <Dropdown
          placeholder="All Statuses"
          selectedKey={filters.status || ''}
          options={STATUS_OPTIONS}
          onChange={handleStatusChange}
          styles={dropdownStyles}
          label="Status"
        />
        <DatePicker
          label="From"
          value={filters.dateFrom}
          onSelectDate={handleDateFromChange}
          styles={datePickerStyles}
          placeholder="Start date..."
        />
        <DatePicker
          label="To"
          value={filters.dateTo}
          onSelectDate={handleDateToChange}
          styles={datePickerStyles}
          placeholder="End date..."
        />
        <TextField
          label="Employee"
          placeholder="Search by name..."
          onChange={handleEmployeeSearchChange}
          styles={{ root: { width: 180 } }}
        />
        <div className={styles.filterActions}>
          <PrimaryButton
            text="Apply Filters"
            onClick={handleApplyFilters}
            styles={{ root: { minWidth: 100 } }}
          />
          <DefaultButton
            text="Clear"
            onClick={handleClearFilters}
            styles={{ root: { minWidth: 60 } }}
          />
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        {loading && (
          <div className={styles.loadingContainer}>
            <Spinner size={SpinnerSize.small} label="Refreshing..." />
          </div>
        )}
        {!loading && sortedItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No bookings found. Adjust your filters to see results.
            </p>
          </div>
        ) : !loading ? (
          <DetailsList
            items={sortedItems}
            columns={columns}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            isHeaderVisible={true}
          />
        ) : null}
      </div>

      {/* Cancel booking dialog with required reason */}
      <Dialog
        hidden={!cancelDialog.booking}
        onDismiss={handleCancelDismiss}
        dialogContentProps={cancelDialogContentProps}
        modalProps={cancelDialogModalProps}
      >
        <div className={styles.cancelReasonField}>
          <TextField
            label="Reason for cancellation"
            placeholder="Enter reason..."
            multiline
            rows={3}
            value={cancelDialog.reason}
            onChange={handleCancelReasonChange}
            required
          />
        </div>
        {cancelDialog.error && (
          <div className={styles.dialogError}>
            <MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
              {cancelDialog.error}
            </MessageBar>
          </div>
        )}
        <DialogFooter>
          <PrimaryButton
            text="Cancel Booking"
            onClick={handleCancelConfirm}
            disabled={isReasonEmpty || cancelDialog.submitting}
          />
          <DefaultButton
            text="Close"
            onClick={handleCancelDismiss}
            disabled={cancelDialog.submitting}
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
};
