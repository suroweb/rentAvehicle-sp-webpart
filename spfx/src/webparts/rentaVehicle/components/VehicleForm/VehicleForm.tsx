import * as React from 'react';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { TextField } from '@fluentui/react/lib/TextField';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { SpinButton } from '@fluentui/react/lib/SpinButton';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './VehicleForm.module.scss';
import { ApiService } from '../../services/ApiService';
import { IVehicle, IVehicleInput } from '../../models/IVehicle';
import { ICategory } from '../../models/ICategory';
import { ILocation } from '../../models/ILocation';
import { PhotoUpload } from './PhotoUpload';

export interface IVehicleFormProps {
  apiService: ApiService;
  vehicle?: IVehicle;
  categories: ICategory[];
  locations: ILocation[];
  onSave: () => void;
  onCancel: () => void;
}

interface IFormState {
  make: string;
  model: string;
  year: string;
  licensePlate: string;
  locationId: number | undefined;
  categoryId: number | undefined;
  capacity: string;
  photoUrl: string | null;
}

interface IFormErrors {
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  locationId?: string;
  categoryId?: string;
  capacity?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1990;
const MAX_YEAR = CURRENT_YEAR + 2;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 50;
const DEFAULT_CAPACITY = 5;

export const VehicleForm: React.FC<IVehicleFormProps> = ({
  apiService,
  vehicle,
  categories,
  locations,
  onSave,
  onCancel,
}) => {
  const isEdit = !!vehicle;

  const [formState, setFormState] = React.useState<IFormState>({
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle ? String(vehicle.year) : String(CURRENT_YEAR),
    licensePlate: vehicle?.licensePlate || '',
    locationId: vehicle?.locationId || undefined,
    categoryId: vehicle?.categoryId || undefined,
    capacity: vehicle ? String(vehicle.capacity) : String(DEFAULT_CAPACITY),
    photoUrl: vehicle?.photoUrl || null,
  });

  const [errors, setErrors] = React.useState<IFormErrors>({});
  const [saving, setSaving] = React.useState<boolean>(false);
  const [apiError, setApiError] = React.useState<string | undefined>(undefined);

  // Build dropdown options -- only active items
  const locationOptions: IDropdownOption[] = React.useMemo(() => {
    return locations
      .filter((loc) => loc.isActive)
      .map((loc) => ({
        key: loc.id,
        text: loc.name,
      }));
  }, [locations]);

  const categoryOptions: IDropdownOption[] = React.useMemo(() => {
    return categories
      .filter((cat) => cat.isActive)
      .map((cat) => ({
        key: cat.id,
        text: cat.name,
      }));
  }, [categories]);

  const handleTextChange = React.useCallback(
    (field: keyof IFormState) =>
      (_event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
        setFormState((prev) => ({ ...prev, [field]: newValue || '' }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    []
  );

  const handleLocationChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) {
        setFormState((prev) => ({ ...prev, locationId: Number(option.key) }));
        setErrors((prev) => ({ ...prev, locationId: undefined }));
      }
    },
    []
  );

  const handleCategoryChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) {
        setFormState((prev) => ({ ...prev, categoryId: Number(option.key) }));
        setErrors((prev) => ({ ...prev, categoryId: undefined }));
      }
    },
    []
  );

  const handleCapacityChange = React.useCallback(
    (_event: React.SyntheticEvent<HTMLElement>, newValue?: string): void => {
      if (newValue !== undefined) {
        setFormState((prev) => ({ ...prev, capacity: newValue }));
        setErrors((prev) => ({ ...prev, capacity: undefined }));
      }
    },
    []
  );

  const handleCapacityIncrement = React.useCallback(
    (value: string): string => {
      const num = parseInt(value, 10);
      if (isNaN(num)) return String(DEFAULT_CAPACITY);
      const next = Math.min(num + 1, MAX_CAPACITY);
      setErrors((prev) => ({ ...prev, capacity: undefined }));
      return String(next);
    },
    []
  );

  const handleCapacityDecrement = React.useCallback(
    (value: string): string => {
      const num = parseInt(value, 10);
      if (isNaN(num)) return String(DEFAULT_CAPACITY);
      const next = Math.max(num - 1, MIN_CAPACITY);
      setErrors((prev) => ({ ...prev, capacity: undefined }));
      return String(next);
    },
    []
  );

  const handlePhotoChange = React.useCallback((url: string | null): void => {
    setFormState((prev) => ({ ...prev, photoUrl: url }));
  }, []);

  const validate = React.useCallback((): IFormErrors => {
    const errs: IFormErrors = {};

    if (!formState.make.trim()) {
      errs.make = 'Make is required';
    } else if (formState.make.trim().length > 100) {
      errs.make = 'Make must be 100 characters or less';
    }

    if (!formState.model.trim()) {
      errs.model = 'Model is required';
    } else if (formState.model.trim().length > 100) {
      errs.model = 'Model must be 100 characters or less';
    }

    const yearNum = parseInt(formState.year, 10);
    if (isNaN(yearNum)) {
      errs.year = 'Year must be a number';
    } else if (yearNum < MIN_YEAR || yearNum > MAX_YEAR) {
      errs.year = `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`;
    }

    if (!formState.licensePlate.trim()) {
      errs.licensePlate = 'License plate is required';
    } else if (formState.licensePlate.trim().length > 20) {
      errs.licensePlate = 'License plate must be 20 characters or less';
    }

    if (formState.locationId === undefined) {
      errs.locationId = 'Location is required';
    }

    if (formState.categoryId === undefined) {
      errs.categoryId = 'Category is required';
    }

    const capacityNum = parseInt(formState.capacity, 10);
    if (isNaN(capacityNum)) {
      errs.capacity = 'Capacity must be a number';
    } else if (capacityNum < MIN_CAPACITY || capacityNum > MAX_CAPACITY) {
      errs.capacity = `Capacity must be between ${MIN_CAPACITY} and ${MAX_CAPACITY}`;
    }

    return errs;
  }, [formState]);

  const handleSubmit = React.useCallback(async (): Promise<void> => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setApiError(undefined);

    const input: IVehicleInput = {
      make: formState.make.trim(),
      model: formState.model.trim(),
      year: parseInt(formState.year, 10),
      licensePlate: formState.licensePlate.trim(),
      locationId: formState.locationId as number,
      categoryId: formState.categoryId as number,
      capacity: parseInt(formState.capacity, 10),
      photoUrl: formState.photoUrl,
    };

    try {
      if (isEdit && vehicle) {
        await apiService.updateVehicle(vehicle.id, input);
      } else {
        await apiService.createVehicle(input);
      }
      onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save vehicle';
      setApiError(message);
    } finally {
      setSaving(false);
    }
  }, [validate, formState, isEdit, vehicle, apiService, onSave]);

  return (
    <div className={styles.vehicleForm}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>{isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
      </div>

      {apiError && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setApiError(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 16 } }}
        >
          {apiError}
        </MessageBar>
      )}

      <div className={styles.formContainer}>
        <div className={styles.fieldGroup}>
          <TextField
            label="Make"
            required
            value={formState.make}
            onChange={handleTextChange('make')}
            errorMessage={errors.make}
            maxLength={100}
            placeholder="e.g. Toyota"
            disabled={saving}
          />
        </div>

        <div className={styles.fieldGroup}>
          <TextField
            label="Model"
            required
            value={formState.model}
            onChange={handleTextChange('model')}
            errorMessage={errors.model}
            maxLength={100}
            placeholder="e.g. Corolla"
            disabled={saving}
          />
        </div>

        <div className={styles.fieldGroup}>
          <TextField
            label="Year"
            required
            value={formState.year}
            onChange={handleTextChange('year')}
            errorMessage={errors.year}
            placeholder={`${MIN_YEAR} - ${MAX_YEAR}`}
            disabled={saving}
            type="number"
            min={MIN_YEAR}
            max={MAX_YEAR}
          />
        </div>

        <div className={styles.fieldGroup}>
          <TextField
            label="License Plate"
            required
            value={formState.licensePlate}
            onChange={handleTextChange('licensePlate')}
            errorMessage={errors.licensePlate}
            maxLength={20}
            placeholder="e.g. ABC-1234"
            disabled={saving}
          />
        </div>

        <div className={styles.fieldGroup}>
          <Dropdown
            label="Location"
            required
            selectedKey={formState.locationId}
            options={locationOptions}
            onChange={handleLocationChange}
            errorMessage={errors.locationId}
            placeholder="Select a location"
            disabled={saving}
          />
        </div>

        <div className={styles.fieldGroup}>
          <Dropdown
            label="Category"
            required
            selectedKey={formState.categoryId}
            options={categoryOptions}
            onChange={handleCategoryChange}
            errorMessage={errors.categoryId}
            placeholder="Select a category"
            disabled={saving}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SpinButton
            label="Capacity"
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            value={formState.capacity}
            onChange={handleCapacityChange}
            onIncrement={handleCapacityIncrement}
            onDecrement={handleCapacityDecrement}
            disabled={saving}
            incrementButtonAriaLabel="Increase capacity"
            decrementButtonAriaLabel="Decrease capacity"
          />
          {errors.capacity && (
            <span
              style={{
                fontSize: 12,
                color: '#a4262c',
                display: 'block',
                marginTop: 4,
              }}
            >
              {errors.capacity}
            </span>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <PhotoUpload photoUrl={formState.photoUrl} onChange={handlePhotoChange} />
        </div>

        <div className={styles.buttonRow}>
          {saving ? (
            <Spinner size={SpinnerSize.medium} label="Saving..." />
          ) : (
            <>
              <PrimaryButton
                text={isEdit ? 'Save Changes' : 'Create Vehicle'}
                onClick={handleSubmit}
                iconProps={{ iconName: 'Save' }}
              />
              <DefaultButton text="Cancel" onClick={onCancel} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
