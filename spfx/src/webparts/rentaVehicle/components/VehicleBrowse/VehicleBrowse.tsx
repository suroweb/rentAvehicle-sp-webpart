import * as React from 'react';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { DayOfWeek } from '@fluentui/react/lib/Calendar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Shimmer } from '@fluentui/react/lib/Shimmer';
import styles from './VehicleBrowse.module.scss';
import { ApiService } from '../../services/ApiService';
import { IAvailableVehicle } from '../../models/IBooking';
import { ILocation } from '../../models/ILocation';
import { ICategory } from '../../models/ICategory';
import { localToUtcIso } from '../../hooks/useTimezone';
import { VehicleCard } from './VehicleCard';

export interface IDateContext {
  startDate: Date;
  startHour: number;
  endDate: Date;
  endHour: number;
}

export interface IVehicleBrowseProps {
  apiService: ApiService;
  onNavigateToDetail: (vehicleId: number, dateContext?: IDateContext) => void;
  userOfficeLocation?: string | null;
}

// Generate hour dropdown options (0:00 through 23:00)
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

const HOUR_OPTIONS: IDropdownOption[] = [];
for (let i = 0; i < 24; i++) {
  HOUR_OPTIONS.push({ key: i, text: pad2(i) + ':00' });
}

function getNextFullHour(): number {
  const now = new Date();
  const nextHour = now.getHours() + 1;
  return nextHour >= 24 ? 0 : nextHour;
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export const VehicleBrowse: React.FC<IVehicleBrowseProps> = ({
  apiService,
  onNavigateToDetail,
  userOfficeLocation,
}) => {
  // Filter state
  const [locations, setLocations] = React.useState<ILocation[]>([]);
  const [categories, setCategories] = React.useState<ICategory[]>([]);
  const [selectedLocationId, setSelectedLocationId] = React.useState<number | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | undefined>(undefined);
  const [startDate, setStartDate] = React.useState<Date>(getToday);
  const [endDate, setEndDate] = React.useState<Date>(getToday);
  const [startHour, setStartHour] = React.useState<number>(getNextFullHour);
  const [endHour, setEndHour] = React.useState<number>(() => {
    const next = getNextFullHour();
    return next >= 23 ? 23 : next + 1;
  });

  // Results state
  const [vehicles, setVehicles] = React.useState<IAvailableVehicle[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [searching, setSearching] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  // Filtered hour options based on whether today is selected
  const startHourOptions = React.useMemo(function filterStartHours(): IDropdownOption[] {
    return getFilteredHourOptions(startDate);
  }, [startDate]);

  const endHourOptions = React.useMemo(function filterEndHours(): IDropdownOption[] {
    return getFilteredHourOptions(endDate);
  }, [endDate]);

  // Selected location timezone for time conversion
  const selectedLocationTimezone = React.useMemo(() => {
    if (selectedLocationId === undefined) return 'UTC';
    const loc = locations.find((l) => l.id === selectedLocationId);
    return loc?.timezone || 'UTC';
  }, [selectedLocationId, locations]);

  // Load locations and categories on mount
  React.useEffect(() => {
    let cancelled = false;

    const loadFilters = async (): Promise<void> => {
      try {
        const [locs, cats] = await Promise.all([
          apiService.getLocationsPublic(),
          apiService.getCategoriesPublic(),
        ]);

        if (cancelled) return;

        // Only show active locations
        const activeLocs = locs.filter((l) => l.isActive);
        setLocations(activeLocs);
        setCategories(cats);

        // Auto-detect employee's location from Entra ID profile
        if (userOfficeLocation && activeLocs.length > 0) {
          const match = activeLocs.find(
            (l) => l.name.toLowerCase() === userOfficeLocation.toLowerCase()
          );
          if (match) {
            setSelectedLocationId(match.id);
          } else {
            // Select first location as fallback
            setSelectedLocationId(activeLocs[0].id);
          }
        } else if (activeLocs.length > 0) {
          setSelectedLocationId(activeLocs[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load filter data';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadFilters().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Unexpected error loading filters');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Location dropdown options
  const locationOptions: IDropdownOption[] = React.useMemo(
    () => locations.map((l) => ({ key: l.id, text: l.name })),
    [locations]
  );

  // Category dropdown options with "All Categories" entry
  const categoryOptions: IDropdownOption[] = React.useMemo(
    () => [
      { key: 'all', text: 'All Categories' },
      ...categories
        .filter((c) => c.isActive)
        .map((c) => ({ key: c.id, text: c.name })),
    ],
    [categories]
  );

  // Handlers
  const handleLocationChange = React.useCallback(
    (_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) setSelectedLocationId(option.key as number);
    },
    []
  );

  const handleCategoryChange = React.useCallback(
    (_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) {
        setSelectedCategoryId(option.key === 'all' ? undefined : (option.key as number));
      }
    },
    []
  );

  const handleStartDateChange = React.useCallback((date: Date | null | undefined): void => {
    if (date) setStartDate(date);
  }, []);

  const handleEndDateChange = React.useCallback((date: Date | null | undefined): void => {
    if (date) setEndDate(date);
  }, []);

  const handleStartHourChange = React.useCallback(
    (_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) setStartHour(option.key as number);
    },
    []
  );

  const handleEndHourChange = React.useCallback(
    (_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) setEndHour(option.key as number);
    },
    []
  );

  const handleSearch = React.useCallback(async (): Promise<void> => {
    if (selectedLocationId === undefined) {
      setError('Please select a location');
      return;
    }

    // Convert selected date+hour to UTC using the location's timezone
    const startTimeUtc = localToUtcIso(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startHour,
      selectedLocationTimezone
    );
    const endTimeUtc = localToUtcIso(
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endHour,
      selectedLocationTimezone
    );

    // Validate end is after start
    if (new Date(endTimeUtc) <= new Date(startTimeUtc)) {
      setError('End date/time must be after start date/time');
      return;
    }

    setSearching(true);
    setError(undefined);

    try {
      const results = await apiService.browseAvailableVehicles(
        selectedLocationId,
        startTimeUtc,
        endTimeUtc,
        selectedCategoryId
      );
      setVehicles(results);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search vehicles';
      setError(message);
    } finally {
      setSearching(false);
    }
  }, [
    selectedLocationId,
    selectedCategoryId,
    startDate,
    endDate,
    startHour,
    endHour,
    selectedLocationTimezone,
    apiService,
  ]);

  const handleCardSelect = React.useCallback(
    (vehicleId: number): void => {
      onNavigateToDetail(vehicleId, {
        startDate: startDate,
        startHour: startHour,
        endDate: endDate,
        endHour: endHour,
      });
    },
    [onNavigateToDetail, startDate, startHour, endDate, endHour]
  );

  // Loading state
  if (loading) {
    return (
      <div className={styles.vehicleBrowse}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vehicleBrowse}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Browse Vehicles</h2>
      </div>

      {error && (
        <div className={styles.errorBar}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={() => setError(undefined)}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        </div>
      )}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <Dropdown
            label="Location"
            selectedKey={selectedLocationId}
            options={locationOptions}
            onChange={handleLocationChange}
            placeholder="Select a location"
          />
        </div>

        <div className={styles.filterField}>
          <DatePicker
            label="Start date"
            value={startDate}
            onSelectDate={handleStartDateChange}
            firstDayOfWeek={DayOfWeek.Monday}
            minDate={getToday()}
            formatDate={(date?: Date) =>
              date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
            }
          />
        </div>

        <div className={styles.filterFieldNarrow}>
          <Dropdown
            label="Start time"
            selectedKey={startHour}
            options={startHourOptions}
            onChange={handleStartHourChange}
          />
        </div>

        <div className={styles.filterField}>
          <DatePicker
            label="End date"
            value={endDate}
            onSelectDate={handleEndDateChange}
            firstDayOfWeek={DayOfWeek.Monday}
            minDate={startDate}
            formatDate={(date?: Date) =>
              date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
            }
          />
        </div>

        <div className={styles.filterFieldNarrow}>
          <Dropdown
            label="End time"
            selectedKey={endHour}
            options={endHourOptions}
            onChange={handleEndHourChange}
          />
        </div>

        <div className={styles.filterField}>
          <Dropdown
            label="Category"
            selectedKey={selectedCategoryId || 'all'}
            options={categoryOptions}
            onChange={handleCategoryChange}
          />
        </div>

        <div className={styles.searchButton}>
          <PrimaryButton
            text="Search"
            iconProps={{ iconName: 'Search' }}
            onClick={handleSearch}
            disabled={searching || selectedLocationId === undefined}
          />
        </div>
      </div>

      {/* Loading shimmer during search */}
      {searching && (
        <div className={styles.shimmerGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.shimmerCard}>
              <Shimmer width="100%" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!searching && hasSearched && (
        <>
          <div className={styles.resultsInfo}>
            {vehicles.length === 0
              ? 'No vehicles available for this time slot'
              : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} available`}
          </div>

          {vehicles.length > 0 && (
            <div className={styles.cardGrid}>
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  timezone={selectedLocationTimezone}
                  onSelect={handleCardSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Initial state before first search */}
      {!searching && !hasSearched && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Select a location, date range, and click Search to browse available vehicles.
          </p>
        </div>
      )}
    </div>
  );
};
