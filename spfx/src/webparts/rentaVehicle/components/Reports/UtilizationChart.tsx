import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import {
  HorizontalBarChartWithAxis,
  IHorizontalBarChartWithAxisDataPoint,
} from '@fluentui/react-charting';
import { IUtilizationData, IUtilizationVehicleData } from '../../models/IReport';
import styles from './Reports.module.scss';

export interface IUtilizationChartProps {
  data: IUtilizationData[] | IUtilizationVehicleData[];
  isVehicleView: boolean;
  loading: boolean;
  selectedLocationName?: string;
  onLocationClick?: (locationId: number) => void;
}

/** Type guard for location-level data. */
function isLocationData(item: IUtilizationData | IUtilizationVehicleData): item is IUtilizationData {
  return (item as IUtilizationData).locationName !== undefined;
}

/** Type guard for vehicle-level data. */
function isVehicleData(item: IUtilizationData | IUtilizationVehicleData): item is IUtilizationVehicleData {
  return (item as IUtilizationVehicleData).vehicleId !== undefined;
}

export function UtilizationChart(props: IUtilizationChartProps): React.ReactElement {
  const data = props.data;
  const isVehicleView = props.isVehicleView;
  const loading = props.loading;
  const selectedLocationName = props.selectedLocationName;
  const onLocationClick = props.onLocationClick;

  const heading = isVehicleView && selectedLocationName
    ? 'Utilization at ' + selectedLocationName
    : 'Utilization by Location';

  if (loading) {
    return (
      <div className={styles.chartSection}>
        <h3 className={styles.sectionHeading}>{heading}</h3>
        <div className={styles.chartLoadingContainer}>
          <Spinner size={SpinnerSize.medium} label="Loading utilization data..." />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.chartSection}>
        <h3 className={styles.sectionHeading}>{heading}</h3>
        <p className={styles.emptyMessage}>No data available</p>
      </div>
    );
  }

  const chartData: IHorizontalBarChartWithAxisDataPoint[] = data.map(
    function mapDataPoint(item: IUtilizationData | IUtilizationVehicleData): IHorizontalBarChartWithAxisDataPoint {
      let yLabel: string;
      let clickHandler: (() => void) | undefined;

      if (isVehicleData(item)) {
        yLabel = item.make + ' ' + item.model + ' (' + item.licensePlate + ')';
      } else if (isLocationData(item)) {
        yLabel = item.locationName;
        // Drill-down click handler for location bars
        if (!isVehicleView && onLocationClick) {
          const locId = item.locationId;
          const handler = onLocationClick;
          clickHandler = function onBarClick(): void {
            handler(locId);
          };
        }
      } else {
        yLabel = 'Unknown';
      }

      const point: IHorizontalBarChartWithAxisDataPoint = {
        x: item.utilizationRate,
        y: yLabel,
        color: '#0078d4',
        onClick: clickHandler,
      };

      return point;
    }
  );

  return (
    <div className={styles.chartSection}>
      <h3 className={styles.sectionHeading}>{heading}</h3>
      <div className={styles.chartContainer}>
        <HorizontalBarChartWithAxis
          data={chartData}
          showYAxisLables={true}
          yAxisTickCount={data.length}
          barHeight={24}
          calloutProps={{ doNotLayer: true }}
          styles={{
            root: {
              cursor: !isVehicleView ? 'pointer' : 'default',
            },
          }}
        />
      </div>
    </div>
  );
}
