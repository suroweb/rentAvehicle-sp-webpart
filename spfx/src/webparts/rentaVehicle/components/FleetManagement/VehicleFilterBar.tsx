import * as React from 'react';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { Stack } from '@fluentui/react/lib/Stack';
import { IVehicleFilters } from '../../models/IVehicle';
import { ILocation } from '../../models/ILocation';
import { ICategory } from '../../models/ICategory';

export interface IVehicleFilterBarProps {
  locations: ILocation[];
  categories: ICategory[];
  filters: IVehicleFilters;
  onFilterChange: (filters: IVehicleFilters) => void;
}

const STATUS_OPTIONS: IDropdownOption[] = [
  { key: '', text: 'All Statuses' },
  { key: 'Available', text: 'Available' },
  { key: 'InMaintenance', text: 'In Maintenance' },
  { key: 'Retired', text: 'Retired' },
  { key: 'Reserved', text: 'Reserved' },
];

export const VehicleFilterBar: React.FC<IVehicleFilterBarProps> = ({
  locations,
  categories,
  filters,
  onFilterChange,
}) => {
  const searchTimerRef = React.useRef<number | undefined>(undefined);

  const locationOptions: IDropdownOption[] = React.useMemo(() => {
    const options: IDropdownOption[] = [{ key: '', text: 'All Locations' }];
    locations.forEach((loc) => {
      options.push({ key: String(loc.id), text: loc.name });
    });
    return options;
  }, [locations]);

  const categoryOptions: IDropdownOption[] = React.useMemo(() => {
    const options: IDropdownOption[] = [{ key: '', text: 'All Categories' }];
    categories.forEach((cat) => {
      options.push({ key: String(cat.id), text: cat.name });
    });
    return options;
  }, [categories]);

  const handleLocationChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (!option) return;
      const locationId = option.key === '' ? undefined : Number(option.key);
      onFilterChange({ ...filters, locationId });
    },
    [filters, onFilterChange]
  );

  const handleStatusChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (!option) return;
      const status = option.key === '' ? undefined : String(option.key);
      onFilterChange({ ...filters, status });
    },
    [filters, onFilterChange]
  );

  const handleCategoryChange = React.useCallback(
    (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (!option) return;
      const categoryId = option.key === '' ? undefined : Number(option.key);
      onFilterChange({ ...filters, categoryId });
    },
    [filters, onFilterChange]
  );

  const handleSearchChange = React.useCallback(
    (_event?: React.ChangeEvent<HTMLInputElement>, newValue?: string): void => {
      if (searchTimerRef.current !== undefined) {
        window.clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = window.setTimeout(() => {
        const search = newValue && newValue.trim() ? newValue.trim() : undefined;
        onFilterChange({ ...filters, search });
      }, 300);
    },
    [filters, onFilterChange]
  );

  const handleSearchClear = React.useCallback((): void => {
    if (searchTimerRef.current !== undefined) {
      window.clearTimeout(searchTimerRef.current);
    }
    onFilterChange({ ...filters, search: undefined });
  }, [filters, onFilterChange]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current !== undefined) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const dropdownStyles = { dropdown: { width: 180 } };

  return (
    <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="end">
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
      <Dropdown
        placeholder="All Categories"
        selectedKey={filters.categoryId !== undefined ? String(filters.categoryId) : ''}
        options={categoryOptions}
        onChange={handleCategoryChange}
        styles={dropdownStyles}
        label="Category"
      />
      <SearchBox
        placeholder="Search make, model, or plate..."
        onChange={handleSearchChange}
        onClear={handleSearchClear}
        styles={{ root: { width: 220 } }}
      />
    </Stack>
  );
};
