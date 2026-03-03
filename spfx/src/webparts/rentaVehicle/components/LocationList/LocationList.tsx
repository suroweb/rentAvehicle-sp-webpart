import * as React from 'react';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
} from '@fluentui/react/lib/DetailsList';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Icon } from '@fluentui/react/lib/Icon';
import { ComboBox, IComboBox, IComboBoxOption } from '@fluentui/react/lib/ComboBox';
import styles from './LocationList.module.scss';
import { ApiService } from '../../services/ApiService';
import { ILocation, ILocationSyncResult } from '../../models/ILocation';
import { AppRole } from '../../models/IUser';
import { TIMEZONE_OPTIONS, ITimezoneOption } from '../../data/timezones';

export interface ILocationListProps {
  apiService: ApiService;
  userRole: AppRole;
}

export const LocationList: React.FC<ILocationListProps> = ({ apiService, userRole }) => {
  const [locations, setLocations] = React.useState<ILocation[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [syncing, setSyncing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [syncResult, setSyncResult] = React.useState<ILocationSyncResult | undefined>(undefined);

  // Timezone inline editing state
  const [editingLocationId, setEditingLocationId] = React.useState<number | null>(null);
  const [savingTimezoneId, setSavingTimezoneId] = React.useState<number | null>(null);
  const [savedTimezoneId, setSavedTimezoneId] = React.useState<number | null>(null);

  // Timezone search/filter state
  const [filteredTimezones, setFilteredTimezones] = React.useState<ITimezoneOption[]>(TIMEZONE_OPTIONS);
  const [timezoneSearchText, setTimezoneSearchText] = React.useState<string>('');

  const handleTimezoneInputChange = React.useCallback((text: string): void => {
    setTimezoneSearchText(text);
    if (!text || text.trim() === '') {
      setFilteredTimezones(TIMEZONE_OPTIONS);
      return;
    }
    const query = text.toLowerCase();
    const filtered = TIMEZONE_OPTIONS.filter(
      (opt: ITimezoneOption) => opt.text.toLowerCase().includes(query)
    );
    setFilteredTimezones(filtered);
  }, []);

  const handleTimezoneMenuOpen = React.useCallback((): void => {
    setTimezoneSearchText('');
    setFilteredTimezones(TIMEZONE_OPTIONS);
  }, []);

  const fetchLocations = React.useCallback(async (): Promise<void> => {
    try {
      const data = await apiService.getLocations();
      setLocations(data);
      setError(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load locations';
      setError(message);
    }
  }, [apiService]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLocations()
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLocations]);

  const handleSync = React.useCallback(async (): Promise<void> => {
    setSyncing(true);
    setError(undefined);
    setSyncResult(undefined);

    try {
      const result = await apiService.syncLocations();
      setSyncResult(result);
      await fetchLocations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync locations';
      setError(message);
    } finally {
      setSyncing(false);
    }
  }, [apiService, fetchLocations]);

  const handleTimezoneChange = React.useCallback(
    async (locationId: number, timezone: string): Promise<void> => {
      setTimezoneSearchText('');
      setFilteredTimezones(TIMEZONE_OPTIONS);
      setEditingLocationId(null);
      setSavingTimezoneId(locationId);
      setSavedTimezoneId(null);

      try {
        await apiService.updateLocationTimezone(locationId, timezone);

        // Update local state immediately
        setLocations(function updateLocations(prev: ILocation[]): ILocation[] {
          return prev.map(function mapLocation(loc: ILocation): ILocation {
            if (loc.id === locationId) {
              return Object.assign({}, loc, { timezone: timezone });
            }
            return loc;
          });
        });

        setSavingTimezoneId(null);
        setSavedTimezoneId(locationId);

        // Clear saved indicator after 2 seconds
        setTimeout(function clearSaved(): void {
          setSavedTimezoneId(function clearIfMatch(prev: number | null): number | null {
            return prev === locationId ? null : prev;
          });
        }, 2000);
      } catch (err) {
        setSavingTimezoneId(null);
        const message = err instanceof Error ? err.message : 'Failed to update timezone';
        setError(message);
      }
    },
    [apiService]
  );

  const isSuperAdmin = userRole === 'SuperAdmin';

  const formatDate = (dateString: string): string => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const columns: IColumn[] = React.useMemo(
    () => [
      {
        key: 'name',
        name: 'Location Name',
        fieldName: 'name',
        minWidth: 180,
        maxWidth: 300,
        isResizable: true,
        onRender: (item: ILocation) => (
          <span
            style={{
              fontWeight: 600,
              color: item.isActive ? '#323130' : '#a19f9d',
            }}
          >
            {item.name}
          </span>
        ),
      },
      {
        key: 'vehicleCount',
        name: 'Vehicles',
        fieldName: 'vehicleCount',
        minWidth: 80,
        maxWidth: 100,
        isResizable: true,
        onRender: (item: ILocation) => (
          <span>{item.vehicleCount !== undefined ? item.vehicleCount : '--'}</span>
        ),
      },
      {
        key: 'timezone',
        name: 'Timezone',
        minWidth: 200,
        maxWidth: 320,
        isResizable: true,
        onRender: (item: ILocation) => {
          const tz = item.timezone || 'UTC';
          const isUnconfigured = !item.timezone || item.timezone === 'UTC';

          // Saving state
          if (savingTimezoneId === item.id) {
            return (
              <span className={styles.timezoneSaving}>
                <Spinner size={SpinnerSize.xSmall} />
                Saving...
              </span>
            );
          }

          // Just saved state
          if (savedTimezoneId === item.id) {
            return (
              <span className={styles.timezoneSaved}>
                <Icon iconName="CheckMark" styles={{ root: { fontSize: 12 } }} />
                {tz}
              </span>
            );
          }

          // Editing state
          if (editingLocationId === item.id) {
            return (
              <ComboBox
                allowFreeform={true}
                autoComplete="off"
                options={filteredTimezones}
                text={timezoneSearchText}
                onChange={(_ev: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
                  if (option) {
                    handleTimezoneChange(item.id, option.key as string).catch(() => { /* handled in callback */ });
                  }
                }}
                onInputValueChange={handleTimezoneInputChange}
                onMenuOpen={handleTimezoneMenuOpen}
                onBlur={() => {
                  setEditingLocationId(null);
                  setTimezoneSearchText('');
                  setFilteredTimezones(TIMEZONE_OPTIONS);
                }}
                openOnKeyboardFocus
                shouldRestoreFocus={false}
                className={styles.timezoneComboBox}
                placeholder="Search timezone..."
                calloutProps={{
                  calloutMaxHeight: 320,
                  styles: { root: { minWidth: 320 } }
                }}
              />
            );
          }

          // Read-only display
          return (
            <span
              onClick={() => setEditingLocationId(item.id)}
              className={isUnconfigured ? styles.timezoneUnconfigured : styles.timezoneCell}
              title="Click to edit timezone"
            >
              {isUnconfigured ? 'UTC (not configured)' : tz}
            </span>
          );
        },
      },
      {
        key: 'status',
        name: 'Status',
        minWidth: 130,
        maxWidth: 180,
        isResizable: true,
        onRender: (item: ILocation) => {
          if (item.isActive) {
            return (
              <span className={styles.statusBadgeActive}>Active</span>
            );
          }

          const needsReassignment =
            item.vehicleCount !== undefined && item.vehicleCount > 0;

          return (
            <span className={styles.statusBadgeInactive}>
              <Icon
                iconName="Warning"
                styles={{
                  root: {
                    fontSize: 12,
                    marginRight: 4,
                    color: '#d83b01',
                  },
                }}
              />
              Inactive
              {needsReassignment && (
                <span className={styles.reassignmentBadge}>Needs Reassignment</span>
              )}
            </span>
          );
        },
      },
      {
        key: 'lastSyncedAt',
        name: 'Last Synced',
        fieldName: 'lastSyncedAt',
        minWidth: 150,
        maxWidth: 200,
        isResizable: true,
        onRender: (item: ILocation) => (
          <span style={{ color: '#605e5c', fontSize: 13 }}>
            {formatDate(item.lastSyncedAt)}
          </span>
        ),
      },
    ],
    [editingLocationId, savingTimezoneId, savedTimezoneId, handleTimezoneChange, filteredTimezones, timezoneSearchText, handleTimezoneInputChange, handleTimezoneMenuOpen]
  );

  if (loading) {
    return (
      <div className={styles.locationList}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading locations..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.locationList}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Office Locations</h2>
        {isSuperAdmin && (
          <PrimaryButton
            text={syncing ? 'Syncing...' : 'Sync Locations'}
            iconProps={{ iconName: 'Sync' }}
            onClick={handleSync}
            disabled={syncing}
          />
        )}
      </div>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 12 } }}
        >
          {error}
        </MessageBar>
      )}

      {syncResult && (
        <MessageBar
          messageBarType={MessageBarType.success}
          isMultiline={false}
          onDismiss={() => setSyncResult(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 12 } }}
        >
          {`Sync complete -- Added: ${syncResult.added}, Deactivated: ${syncResult.deactivated}, Total: ${syncResult.total}`}
        </MessageBar>
      )}

      {syncing && (
        <div className={styles.syncingOverlay}>
          <Spinner size={SpinnerSize.medium} label="Syncing locations from Entra ID..." />
        </div>
      )}

      <div className={styles.tableContainer}>
        {locations.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No locations found. {isSuperAdmin ? 'Use the Sync button to fetch locations from Entra ID.' : 'Ask a SuperAdmin to sync locations from Entra ID.'}
            </p>
          </div>
        ) : (
          <DetailsList
            items={locations}
            columns={columns}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            isHeaderVisible={true}
          />
        )}
      </div>
    </div>
  );
};
