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
import styles from './LocationList.module.scss';
import { ApiService } from '../../services/ApiService';
import { ILocation, ILocationSyncResult } from '../../models/ILocation';
import { AppRole } from '../../models/IUser';

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
    []
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
