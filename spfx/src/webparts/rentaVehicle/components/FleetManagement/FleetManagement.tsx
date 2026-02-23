import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import {
  Dialog,
  DialogType,
  DialogFooter,
} from '@fluentui/react/lib/Dialog';
import styles from './FleetManagement.module.scss';
import { ApiService } from '../../services/ApiService';
import { IVehicle, IVehicleFilters, VehicleStatus } from '../../models/IVehicle';
import { ICategory } from '../../models/ICategory';
import { ILocation } from '../../models/ILocation';
import { VehicleTable } from './VehicleTable';
import { VehicleFilterBar } from './VehicleFilterBar';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { VehicleForm } from '../VehicleForm/VehicleForm';

export interface IFleetManagementProps {
  apiService: ApiService;
}

interface IConfirmDialogState {
  hidden: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const STATUS_IMPACT_MESSAGES: Record<string, string> = {
  Available: 'This vehicle will be visible to employees for booking.',
  InMaintenance:
    'This vehicle will be hidden from employee browsing. Existing reservations are not affected.',
  Retired:
    'This vehicle will be removed from active fleet. It will no longer appear in employee browsing. This can be reversed later.',
  Reserved: 'This status is typically set automatically when a booking is made.',
};

const STATUS_LABELS: Record<string, string> = {
  Available: 'Available',
  InMaintenance: 'In Maintenance',
  Retired: 'Retired',
};

const STATUS_CHANGE_OPTIONS: IDropdownOption[] = [
  { key: 'Available', text: 'Available' },
  { key: 'InMaintenance', text: 'In Maintenance' },
  { key: 'Retired', text: 'Retired' },
];

const defaultConfirmState: IConfirmDialogState = {
  hidden: true,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  onConfirm: () => undefined,
};

export const FleetManagement: React.FC<IFleetManagementProps> = ({ apiService }) => {
  const [vehicles, setVehicles] = React.useState<IVehicle[]>([]);
  const [categories, setCategories] = React.useState<ICategory[]>([]);
  const [locations, setLocations] = React.useState<ILocation[]>([]);
  const [filters, setFilters] = React.useState<IVehicleFilters>({});
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] =
    React.useState<IConfirmDialogState>(defaultConfirmState);

  // Vehicle form state
  const [showForm, setShowForm] = React.useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = React.useState<IVehicle | null>(null);

  // Status change picker dialog state
  const [statusPickerVehicle, setStatusPickerVehicle] = React.useState<IVehicle | undefined>(
    undefined
  );
  const [selectedNewStatus, setSelectedNewStatus] = React.useState<string>('Available');

  const fetchVehicles = React.useCallback(
    async (currentFilters: IVehicleFilters): Promise<void> => {
      try {
        const data = await apiService.getVehicles(currentFilters);
        setVehicles(data);
        setError(undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load vehicles';
        setError(message);
      }
    },
    [apiService]
  );

  // Initial load
  React.useEffect(() => {
    let cancelled = false;

    const loadAll = async (): Promise<void> => {
      setLoading(true);
      try {
        const [vehicleData, cats, locs] = await Promise.all([
          apiService.getVehicles(filters),
          apiService.getCategories(),
          apiService.getLocations(),
        ]);
        if (!cancelled) {
          setVehicles(vehicleData);
          setCategories(cats);
          setLocations(locs);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load fleet data';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAll().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Unexpected error loading fleet data');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch vehicles when filters change (after initial load)
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    fetchVehicles(filters).catch(() => undefined);
  }, [filters, fetchVehicles]);

  const handleFilterChange = React.useCallback((newFilters: IVehicleFilters): void => {
    setFilters(newFilters);
  }, []);

  const handleEdit = React.useCallback((vehicle: IVehicle): void => {
    setEditingVehicle(vehicle);
    setShowForm(true);
  }, []);

  const handleChangeStatus = React.useCallback((vehicle: IVehicle): void => {
    setStatusPickerVehicle(vehicle);
    setSelectedNewStatus(
      vehicle.status === 'Available' ? 'InMaintenance' : 'Available'
    );
  }, []);

  const handleStatusPickerConfirm = React.useCallback((): void => {
    if (!statusPickerVehicle) return;

    const newStatus = selectedNewStatus as VehicleStatus;
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const impactMessage =
      STATUS_IMPACT_MESSAGES[newStatus] || 'Are you sure you want to change the status?';

    // Close status picker and show confirmation
    const vehicleRef = statusPickerVehicle;
    setStatusPickerVehicle(undefined);

    setConfirmDialog({
      hidden: false,
      title: `Change Status to "${statusLabel}"`,
      message: `${vehicleRef.make} ${vehicleRef.model} (${vehicleRef.licensePlate}): ${impactMessage}`,
      confirmLabel: 'Change Status',
      onConfirm: () => {
        apiService
          .updateVehicleStatus(vehicleRef.id, newStatus)
          .then(() => fetchVehicles(filters))
          .then(() => setConfirmDialog(defaultConfirmState))
          .catch((err: Error) => {
            setError(err.message || 'Failed to update vehicle status');
            setConfirmDialog(defaultConfirmState);
          });
      },
    });
  }, [statusPickerVehicle, selectedNewStatus, apiService, filters, fetchVehicles]);

  const handleRemove = React.useCallback(
    (vehicle: IVehicle): void => {
      setConfirmDialog({
        hidden: false,
        title: 'Remove Vehicle',
        message: `Are you sure you want to archive "${vehicle.make} ${vehicle.model}" (${vehicle.licensePlate})? This will archive the vehicle. It will no longer appear in the fleet list. This action can be reversed.`,
        confirmLabel: 'Remove',
        onConfirm: () => {
          apiService
            .deleteVehicle(vehicle.id)
            .then(() => fetchVehicles(filters))
            .then(() => setConfirmDialog(defaultConfirmState))
            .catch((err: Error) => {
              setError(err.message || 'Failed to remove vehicle');
              setConfirmDialog(defaultConfirmState);
            });
        },
      });
    },
    [apiService, filters, fetchVehicles]
  );

  const handleDismissConfirm = React.useCallback((): void => {
    setConfirmDialog(defaultConfirmState);
  }, []);

  const handleDismissStatusPicker = React.useCallback((): void => {
    setStatusPickerVehicle(undefined);
  }, []);

  const handleStatusDropdownChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) {
        setSelectedNewStatus(String(option.key));
      }
    },
    []
  );

  const handleAddVehicle = React.useCallback((): void => {
    setEditingVehicle(null);
    setShowForm(true);
  }, []);

  const handleFormSave = React.useCallback((): void => {
    setShowForm(false);
    setEditingVehicle(null);
    // Re-fetch vehicles to reflect the new/updated vehicle
    fetchVehicles(filters).catch(() => undefined);
  }, [fetchVehicles, filters]);

  const handleFormCancel = React.useCallback((): void => {
    setShowForm(false);
    setEditingVehicle(null);
  }, []);

  if (loading) {
    return (
      <div className={styles.fleetManagement}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading fleet data..." />
        </div>
      </div>
    );
  }

  // When form is shown, render VehicleForm instead of the table (full-page form per locked decision)
  if (showForm) {
    return (
      <VehicleForm
        apiService={apiService}
        vehicle={editingVehicle || undefined}
        categories={categories}
        locations={locations}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
      />
    );
  }

  const statusPickerDialogContentProps = {
    type: DialogType.normal,
    title: statusPickerVehicle
      ? `Change Status: ${statusPickerVehicle.make} ${statusPickerVehicle.model}`
      : 'Change Status',
    subText: 'Select the new status for this vehicle:',
  };

  const statusPickerModalProps = {
    isBlocking: true,
    styles: { main: { maxWidth: 400 } },
  };

  return (
    <div className={styles.fleetManagement}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Fleet Management</h2>
        <PrimaryButton
          text="Add Vehicle"
          iconProps={{ iconName: 'Add' }}
          onClick={handleAddVehicle}
        />
      </div>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
        >
          {error}
        </MessageBar>
      )}

      <div className={styles.filterSection}>
        <VehicleFilterBar
          locations={locations}
          categories={categories}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>

      <div className={styles.tableContainer}>
        {vehicles.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No vehicles found. Adjust your filters or add a new vehicle.
            </p>
          </div>
        ) : (
          <VehicleTable
            vehicles={vehicles}
            onEdit={handleEdit}
            onChangeStatus={handleChangeStatus}
            onRemove={handleRemove}
          />
        )}
      </div>

      {/* Confirmation dialog for removal and status change confirmation */}
      <ConfirmDialog
        hidden={confirmDialog.hidden}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onDismiss={handleDismissConfirm}
      />

      {/* Status picker dialog -- Step 1: Select new status */}
      <Dialog
        hidden={!statusPickerVehicle}
        onDismiss={handleDismissStatusPicker}
        dialogContentProps={statusPickerDialogContentProps}
        modalProps={statusPickerModalProps}
      >
        <Dropdown
          selectedKey={selectedNewStatus}
          options={STATUS_CHANGE_OPTIONS}
          onChange={handleStatusDropdownChange}
          label="New Status"
          styles={{ dropdown: { width: '100%' } }}
        />
        <DialogFooter>
          <PrimaryButton onClick={handleStatusPickerConfirm} text="Continue" />
          <DefaultButton onClick={handleDismissStatusPicker} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </div>
  );
};
