import * as React from 'react';
import { DefaultButton, CommandBarButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { IconButton } from '@fluentui/react/lib/Button';
import styles from './Reports.module.scss';
import { ApiService } from '../../services/ApiService';
import { ILocation } from '../../models/ILocation';
import { ICategory } from '../../models/ICategory';
import {
  IKpiSummary,
  IUtilizationData,
  IUtilizationVehicleData,
  ITrendData,
  IRawBookingRecord,
  DatePreset,
  IDateRange,
  getDateRange,
} from '../../models/IReport';
import { KpiCards } from './KpiCards';
import { UtilizationChart } from './UtilizationChart';
import { TrendChart } from './TrendChart';
import { exportSummaryCSV, exportRawDataCSV } from './ReportExport';

export interface IReportsProps {
  apiService: ApiService;
  locations: ILocation[];
  categories: ICategory[];
}

/** Pad number to two digits. */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/** Format a Date to YYYY-MM-DD for API queries. */
function formatDateForApi(d: Date): string {
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

interface IPresetButton {
  key: DatePreset;
  label: string;
}

const PRESET_BUTTONS: IPresetButton[] = [
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
];

export function Reports(props: IReportsProps): React.ReactElement {
  const apiService = props.apiService;
  const locations = props.locations;
  const categories = props.categories;

  // State: date range
  const [datePreset, setDatePreset] = React.useState<DatePreset>('last30');

  // Computed date range
  const dateRange: IDateRange = React.useMemo(function computeDateRange(): IDateRange {
    return getDateRange(datePreset);
  }, [datePreset]);

  // State: filters
  const [selectedLocationId, setSelectedLocationId] = React.useState<number | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | undefined>(undefined);

  // State: KPI
  const [kpiData, setKpiData] = React.useState<IKpiSummary | null>(null);
  const [kpiLoading, setKpiLoading] = React.useState<boolean>(true);

  // State: utilization
  const [utilizationData, setUtilizationData] = React.useState<IUtilizationData[] | IUtilizationVehicleData[]>([]);
  const [utilizationLoading, setUtilizationLoading] = React.useState<boolean>(true);
  const [isVehicleView, setIsVehicleView] = React.useState<boolean>(false);
  const [selectedLocationName, setSelectedLocationName] = React.useState<string | undefined>(undefined);

  // State: trends
  const [trendData, setTrendData] = React.useState<ITrendData[]>([]);
  const [trendLoading, setTrendLoading] = React.useState<boolean>(true);

  // State: errors
  const [error, setError] = React.useState<string | undefined>(undefined);

  // State: raw export loading
  const [rawExportLoading, setRawExportLoading] = React.useState<boolean>(false);

  // Location dropdown options
  const locationOptions = React.useMemo(function buildLocationOptions(): IDropdownOption[] {
    const options: IDropdownOption[] = [{ key: '', text: 'All Locations' }];
    for (let i = 0; i < locations.length; i++) {
      options.push({ key: String(locations[i].id), text: locations[i].name });
    }
    return options;
  }, [locations]);

  // Category dropdown options
  const categoryOptions = React.useMemo(function buildCategoryOptions(): IDropdownOption[] {
    const options: IDropdownOption[] = [{ key: '', text: 'All Categories' }];
    for (let i = 0; i < categories.length; i++) {
      options.push({ key: String(categories[i].id), text: categories[i].name });
    }
    return options;
  }, [categories]);

  // Fetch all dashboard data
  const fetchDashboardData = React.useCallback(function fetchDashboardDataFn(): void {
    const dateFrom = formatDateForApi(dateRange.from);
    const dateTo = formatDateForApi(dateRange.to);

    setError(undefined);
    setKpiLoading(true);
    setUtilizationLoading(true);
    setTrendLoading(true);
    setIsVehicleView(false);
    setSelectedLocationName(undefined);

    // Fetch KPI
    apiService.getKpi(dateFrom, dateTo)
      .then(function onKpi(data: IKpiSummary): void {
        setKpiData(data);
        setKpiLoading(false);
      })
      .catch(function onKpiErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load KPI data';
        setError(msg);
        setKpiLoading(false);
      });

    // Fetch utilization (location level)
    apiService.getUtilizationReport(dateFrom, dateTo)
      .then(function onUtil(data: IUtilizationData[] | IUtilizationVehicleData[]): void {
        setUtilizationData(data);
        setUtilizationLoading(false);
      })
      .catch(function onUtilErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load utilization data';
        setError(msg);
        setUtilizationLoading(false);
      });

    // Fetch trends
    apiService.getTrends(dateFrom, dateTo, dateRange.granularity, selectedLocationId, selectedCategoryId)
      .then(function onTrend(data: ITrendData[]): void {
        setTrendData(data);
        setTrendLoading(false);
      })
      .catch(function onTrendErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load trend data';
        setError(msg);
        setTrendLoading(false);
      });
  }, [apiService, dateRange, selectedLocationId, selectedCategoryId]);

  // Fetch on mount and when datePreset changes
  React.useEffect(function onDateRangeChange(): void {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refetch trends when location or category filter changes
  const fetchTrends = React.useCallback(function fetchTrendsFn(): void {
    const dateFrom = formatDateForApi(dateRange.from);
    const dateTo = formatDateForApi(dateRange.to);
    setTrendLoading(true);

    apiService.getTrends(dateFrom, dateTo, dateRange.granularity, selectedLocationId, selectedCategoryId)
      .then(function onTrend(data: ITrendData[]): void {
        setTrendData(data);
        setTrendLoading(false);
      })
      .catch(function onTrendErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load trend data';
        setError(msg);
        setTrendLoading(false);
      });
  }, [apiService, dateRange, selectedLocationId, selectedCategoryId]);

  // Handle location drill-down in utilization chart
  const handleLocationClick = React.useCallback(function onLocationClick(locationId: number): void {
    const dateFrom = formatDateForApi(dateRange.from);
    const dateTo = formatDateForApi(dateRange.to);

    // Find location name
    let locName = 'Location';
    for (let i = 0; i < locations.length; i++) {
      if (locations[i].id === locationId) {
        locName = locations[i].name;
        break;
      }
    }

    setSelectedLocationName(locName);
    setUtilizationLoading(true);
    setIsVehicleView(true);

    apiService.getUtilizationReport(dateFrom, dateTo, locationId)
      .then(function onVehicleUtil(data: IUtilizationData[] | IUtilizationVehicleData[]): void {
        setUtilizationData(data);
        setUtilizationLoading(false);
      })
      .catch(function onVehicleUtilErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load vehicle utilization';
        setError(msg);
        setUtilizationLoading(false);
      });
  }, [apiService, dateRange, locations]);

  // Handle back from vehicle view
  const handleBackToLocations = React.useCallback(function onBack(): void {
    const dateFrom = formatDateForApi(dateRange.from);
    const dateTo = formatDateForApi(dateRange.to);

    setIsVehicleView(false);
    setSelectedLocationName(undefined);
    setUtilizationLoading(true);

    apiService.getUtilizationReport(dateFrom, dateTo)
      .then(function onUtil(data: IUtilizationData[] | IUtilizationVehicleData[]): void {
        setUtilizationData(data);
        setUtilizationLoading(false);
      })
      .catch(function onUtilErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to load utilization data';
        setError(msg);
        setUtilizationLoading(false);
      });
  }, [apiService, dateRange]);

  // Export handlers
  const handleExportSummary = React.useCallback(function onExportSummary(): void {
    // Only export location-level data (not vehicle view)
    const locationData = utilizationData as IUtilizationData[];
    if (locationData && locationData.length > 0) {
      exportSummaryCSV(locationData);
    }
  }, [utilizationData]);

  const handleExportRaw = React.useCallback(function onExportRaw(): void {
    const dateFrom = formatDateForApi(dateRange.from);
    const dateTo = formatDateForApi(dateRange.to);

    setRawExportLoading(true);
    apiService.getRawExportData(dateFrom, dateTo)
      .then(function onRawData(data: IRawBookingRecord[]): void {
        exportRawDataCSV(data);
        setRawExportLoading(false);
      })
      .catch(function onRawErr(err: unknown): void {
        const msg = err instanceof Error ? err.message : 'Failed to export raw data';
        setError(msg);
        setRawExportLoading(false);
      });
  }, [apiService, dateRange]);

  // Filter change handlers
  const handleLocationFilterChange = React.useCallback(function onLocationFilter(
    _event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ): void {
    if (!option) return;
    const locId = option.key === '' ? undefined : Number(option.key);
    setSelectedLocationId(locId);
  }, []);

  const handleCategoryFilterChange = React.useCallback(function onCategoryFilter(
    _event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ): void {
    if (!option) return;
    const catId = option.key === '' ? undefined : Number(option.key);
    setSelectedCategoryId(catId);
  }, []);

  // Re-fetch trends when filters change (separate from full dashboard refetch)
  const prevLocationRef = React.useRef<number | undefined>(selectedLocationId);
  const prevCategoryRef = React.useRef<number | undefined>(selectedCategoryId);

  React.useEffect(function onFilterChange(): void {
    if (prevLocationRef.current !== selectedLocationId || prevCategoryRef.current !== selectedCategoryId) {
      prevLocationRef.current = selectedLocationId;
      prevCategoryRef.current = selectedCategoryId;
      fetchTrends();
    }
  }, [selectedLocationId, selectedCategoryId, fetchTrends]);

  return (
    <div className={styles.reports}>
      {/* Header row */}
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Fleet Reports</h2>
        <div className={styles.headerActions}>
          <CommandBarButton
            iconProps={{ iconName: 'BarChartVertical' }}
            text="Export Summary"
            onClick={handleExportSummary}
          />
          <CommandBarButton
            iconProps={{ iconName: 'Download' }}
            text={rawExportLoading ? 'Exporting...' : 'Export Raw Data'}
            onClick={handleExportRaw}
            disabled={rawExportLoading}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className={styles.errorContainer}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={function dismissError(): void { setError(undefined); }}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        </div>
      )}

      {/* Date range preset row */}
      <div className={styles.datePresetRow}>
        {PRESET_BUTTONS.map(function renderPresetBtn(btn: IPresetButton): React.ReactElement {
          return (
            <DefaultButton
              key={btn.key}
              text={btn.label}
              primary={datePreset === btn.key}
              onClick={function onPresetClick(): void { setDatePreset(btn.key); }}
            />
          );
        })}
      </div>

      {/* KPI cards row */}
      <KpiCards kpi={kpiData} loading={kpiLoading} />

      {/* Utilization section */}
      <div className={styles.chartSection}>
        <div className={styles.sectionHeaderRow}>
          {isVehicleView && (
            <IconButton
              iconProps={{ iconName: 'Back' }}
              title="Back to locations"
              ariaLabel="Back to locations"
              onClick={handleBackToLocations}
            />
          )}
        </div>
        <UtilizationChart
          data={utilizationData}
          isVehicleView={isVehicleView}
          loading={utilizationLoading}
          selectedLocationName={selectedLocationName}
          onLocationClick={handleLocationClick}
        />
      </div>

      {/* Filters for trends */}
      <div className={styles.filterRow}>
        <Dropdown
          placeholder="All Locations"
          selectedKey={selectedLocationId !== undefined ? String(selectedLocationId) : ''}
          options={locationOptions}
          onChange={handleLocationFilterChange}
          styles={{ dropdown: { width: 200 } }}
          label="Filter by Location"
        />
        <Dropdown
          placeholder="All Categories"
          selectedKey={selectedCategoryId !== undefined ? String(selectedCategoryId) : ''}
          options={categoryOptions}
          onChange={handleCategoryFilterChange}
          styles={{ dropdown: { width: 200 } }}
          label="Filter by Category"
        />
      </div>

      {/* Trend section */}
      <TrendChart
        data={trendData}
        loading={trendLoading}
        granularity={dateRange.granularity}
      />
    </div>
  );
}
