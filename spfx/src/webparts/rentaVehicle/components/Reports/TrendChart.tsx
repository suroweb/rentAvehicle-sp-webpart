import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import {
  VerticalBarChart,
  IVerticalBarChartDataPoint,
  LineChart,
  ILineChartPoints,
  IChartProps,
} from '@fluentui/react-charting';
import { ITrendData } from '../../models/IReport';
import styles from './Reports.module.scss';

export interface ITrendChartProps {
  data: ITrendData[];
  loading: boolean;
  granularity: 'daily' | 'weekly';
}

/** Pad number to two digits. */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/** Short month names. */
const MONTHS: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format period string to display label. */
function formatPeriodLabel(period: string, granularity: 'daily' | 'weekly'): string {
  try {
    const d = new Date(period);
    if (isNaN(d.getTime())) return period;
    const month = MONTHS[d.getUTCMonth()];
    const day = pad2(d.getUTCDate());
    if (granularity === 'weekly') {
      return 'Week of ' + month + ' ' + day;
    }
    return month + ' ' + day;
  } catch (e) {
    return e ? period : period;
  }
}

export function TrendChart(props: ITrendChartProps): React.ReactElement {
  const data = props.data;
  const loading = props.loading;
  const granularity = props.granularity;

  if (loading) {
    return (
      <div className={styles.chartSection}>
        <h3 className={styles.sectionHeading}>Booking Trends</h3>
        <div className={styles.chartLoadingContainer}>
          <Spinner size={SpinnerSize.medium} label="Loading trend data..." />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.chartSection}>
        <h3 className={styles.sectionHeading}>Booking Trends</h3>
        <p className={styles.emptyMessage}>No trend data available</p>
      </div>
    );
  }

  // Prepare bar chart data for booking counts
  const barData: IVerticalBarChartDataPoint[] = data.map(
    function mapBar(item: ITrendData): IVerticalBarChartDataPoint {
      return {
        x: formatPeriodLabel(item.period, granularity),
        y: item.bookingCount,
        color: '#004e8c',
      };
    }
  );

  // Prepare line chart data for utilization %
  const linePoints: ILineChartPoints[] = [
    {
      legend: 'Utilization %',
      color: '#e3008c',
      data: data.map(function mapLine(item: ITrendData, index: number): { x: number | Date; y: number } {
        return {
          x: index,
          y: item.utilizationPct,
        };
      }),
    },
  ];

  const lineChartData: IChartProps = {
    chartTitle: 'Utilization Trend',
    lineChartData: linePoints,
  };

  // Find peak day from data
  let peakIndex = 0;
  let peakCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].bookingCount > peakCount) {
      peakCount = data[i].bookingCount;
      peakIndex = i;
    }
  }
  const peakLabel = formatPeriodLabel(data[peakIndex].period, granularity);

  return (
    <div className={styles.chartSection}>
      <h3 className={styles.sectionHeading}>Booking Trends</h3>
      <div className={styles.chartContainer}>
        <div className={styles.trendBarChart}>
          <p className={styles.chartSubLabel}>Booking Count</p>
          <VerticalBarChart
            data={barData}
            barWidth={20}
            yAxisTickCount={5}
            calloutProps={{ doNotLayer: true }}
          />
        </div>
        <div className={styles.trendLineChart}>
          <p className={styles.chartSubLabel}>Utilization %</p>
          <LineChart
            data={lineChartData}
            yAxisTickCount={5}
            yMaxValue={100}
            calloutProps={{ doNotLayer: true }}
          />
        </div>
      </div>
      <p className={styles.insightText}>
        {'Busiest period: ' + peakLabel + ' (' + String(peakCount) + ' bookings)'}
      </p>
    </div>
  );
}
