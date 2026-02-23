import * as React from 'react';

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  Available: { background: '#DFF6DD', color: '#107C10' },
  InMaintenance: { background: '#FFF4CE', color: '#797600' },
  Retired: { background: '#FDE7E9', color: '#D13438' },
  Reserved: { background: '#DEECF9', color: '#0078D4' },
};

const STATUS_LABELS: Record<string, string> = {
  Available: 'Available',
  InMaintenance: 'In Maintenance',
  Retired: 'Retired',
  Reserved: 'Reserved',
};

export interface IStatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<IStatusBadgeProps> = ({ status }) => {
  const colors = STATUS_COLORS[status] || { background: '#F3F2F1', color: '#323130' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: colors.background,
        color: colors.color,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
};
