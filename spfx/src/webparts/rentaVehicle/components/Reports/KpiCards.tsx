import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { IKpiSummary } from '../../models/IReport';
import styles from './Reports.module.scss';

export interface IKpiCardsProps {
  kpi: IKpiSummary | null;
  loading: boolean;
}

export function KpiCards(props: IKpiCardsProps): React.ReactElement {
  const kpi = props.kpi;
  const loading = props.loading;

  if (loading) {
    return (
      <div className={styles.kpiRow}>
        <div className={styles.kpiLoadingContainer}>
          <Spinner size={SpinnerSize.medium} label="Loading KPIs..." />
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Utilization Rate', value: kpi ? String(kpi.utilizationRate) + '%' : '--' },
    { label: 'Total Bookings', value: kpi ? String(kpi.totalBookings) : '--' },
    { label: 'Active Bookings', value: kpi ? String(kpi.activeBookings) : '--' },
    { label: 'Overdue', value: kpi ? String(kpi.overdueCount) : '--' },
  ];

  return (
    <div className={styles.kpiRow}>
      {cards.map(function renderCard(card, index): React.ReactElement {
        return (
          <div key={index} className={styles.kpiCard}>
            <div className={styles.kpiValue}>{card.value}</div>
            <div className={styles.kpiLabel}>{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
