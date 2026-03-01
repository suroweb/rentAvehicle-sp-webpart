import * as React from 'react';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
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
import { RangeCalendar, IRangeState } from '../VehicleDetail/RangeCalendar';

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

/**
 * Read the ?simulateError= query param for Browse-specific error simulation.
 * Supported values:
 *   browseFilters — simulate filter load failure (locations/categories API down)
 *   browseSearch  — simulate search API failure after clicking Search
 *   browseEmpty   — simulate zero results from a search
 */
function getBrowseSimulatedError(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get('simulateError');
    if (value && ['browseFilters', 'browseSearch', 'browseEmpty'].indexOf(value) !== -1) {
      return value;
    }
  } catch { /* ignore */ }
  return null;
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

  // Unified range state replacing separate date/hour state
  const [range, setRange] = React.useState<IRangeState>(function initRange(): IRangeState {
    const today = getToday();
    const nextHour = getNextFullHour();
    // If nextHour wrapped to 0 (i.e. it's 23:xx), start from tomorrow instead
    if (nextHour === 0) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        startDate: tomorrow,
        startHour: 8,
        endDate: tomorrow,
        endHour: 9,
      };
    }
    return {
      startDate: today,
      startHour: nextHour,
      endDate: today,
      endHour: nextHour >= 23 ? 23 : nextHour + 1,
    };
  });

  const updateRange = React.useCallback(function onUpdateRange(partial: Partial<IRangeState>): void {
    setRange(function mergeRange(prev: IRangeState): IRangeState {
      return { ...prev, ...partial };
    });
  }, []);

  // Results state
  const [vehicles, setVehicles] = React.useState<IAvailableVehicle[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [searching, setSearching] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  // Filtered hour options based on whether today is selected
  const startHourOptions = React.useMemo(function filterStartHours(): IDropdownOption[] {
    return getFilteredHourOptions(range.startDate);
  }, [range.startDate]);

  const endHourOptions = React.useMemo(function filterEndHours(): IDropdownOption[] {
    return getFilteredHourOptions(range.endDate);
  }, [range.endDate]);

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
        // --- Error simulation: browseFilters ---
        if (getBrowseSimulatedError() === 'browseFilters') {
          await new Promise<void>(resolve => setTimeout(resolve, 800));
          throw new Error('Unable to load locations and categories. The API returned 500 Internal Server Error.');
        }

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

  const handleStartHourChange = React.useCallback(
    function onStartHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) updateRange({ startHour: option.key as number });
    },
    [updateRange]
  );

  const handleEndHourChange = React.useCallback(
    function onEndHourChange(_e: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void {
      if (option) updateRange({ endHour: option.key as number });
    },
    [updateRange]
  );

  const handleSearch = React.useCallback(async (): Promise<void> => {
    if (selectedLocationId === undefined) {
      setError('Please select a location');
      return;
    }

    // Convert selected date+hour to UTC using the location's timezone
    const startTimeUtc = localToUtcIso(
      range.startDate.getFullYear(),
      range.startDate.getMonth() + 1,
      range.startDate.getDate(),
      range.startHour,
      selectedLocationTimezone
    );
    const endTimeUtc = localToUtcIso(
      range.endDate.getFullYear(),
      range.endDate.getMonth() + 1,
      range.endDate.getDate(),
      range.endHour,
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
      // --- Error simulation: browseSearch / browseEmpty ---
      const browseSimError = getBrowseSimulatedError();
      if (browseSimError === 'browseSearch') {
        await new Promise<void>(resolve => setTimeout(resolve, 1200));
        throw new Error('API request failed: 500 Internal Server Error - The server encountered an unexpected condition.');
      }
      if (browseSimError === 'browseEmpty') {
        await new Promise<void>(resolve => setTimeout(resolve, 600));
        setVehicles([]);
        setHasSearched(true);
        return;
      }

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
    range,
    selectedLocationTimezone,
    apiService,
  ]);

  const handleCardSelect = React.useCallback(
    (vehicleId: number): void => {
      onNavigateToDetail(vehicleId, {
        startDate: range.startDate,
        startHour: range.startHour,
        endDate: range.endDate,
        endHour: range.endHour,
      });
    },
    [onNavigateToDetail, range]
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
        <div className={styles.filterRow}>
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
            <Dropdown
              label="Category"
              selectedKey={selectedCategoryId || 'all'}
              options={categoryOptions}
              onChange={handleCategoryChange}
            />
          </div>
        </div>

        <div className={styles.rangeSection}>
          <RangeCalendar
            range={range}
            onRangeChange={updateRange}
          />
          <div className={styles.hourRow}>
            <div className={styles.hourField}>
              <Dropdown
                label="Start time"
                selectedKey={range.startHour}
                options={startHourOptions}
                onChange={handleStartHourChange}
              />
            </div>
            <div className={styles.hourField}>
              <Dropdown
                label="End time"
                selectedKey={range.endHour}
                options={endHourOptions}
                onChange={handleEndHourChange}
              />
            </div>
          </div>
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
