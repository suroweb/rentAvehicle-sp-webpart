import * as React from 'react';
import {
  DetailsList,
  IColumn,
  SelectionMode,
  DetailsListLayoutMode,
} from '@fluentui/react/lib/DetailsList';
import { IconButton, IContextualMenuProps } from '@fluentui/react';
import { Icon } from '@fluentui/react/lib/Icon';
import { IVehicle } from '../../models/IVehicle';
import { StatusBadge } from './StatusBadge';

export interface IVehicleTableProps {
  vehicles: IVehicle[];
  onEdit: (vehicle: IVehicle) => void;
  onChangeStatus: (vehicle: IVehicle) => void;
  onRemove: (vehicle: IVehicle) => void;
}

export const VehicleTable: React.FC<IVehicleTableProps> = ({
  vehicles,
  onEdit,
  onChangeStatus,
  onRemove,
}) => {
  const [sortColumn, setSortColumn] = React.useState<string>('make');
  const [sortDescending, setSortDescending] = React.useState<boolean>(false);

  const onColumnClick = React.useCallback(
    (_ev?: React.MouseEvent<HTMLElement>, column?: IColumn): void => {
      if (!column || !column.fieldName) return;

      const newDescending = sortColumn === column.fieldName ? !sortDescending : false;
      setSortColumn(column.fieldName);
      setSortDescending(newDescending);
    },
    [sortColumn, sortDescending]
  );

  const sortedItems = React.useMemo(() => {
    if (!sortColumn) return vehicles;

    return [...vehicles].sort((a, b) => {
      const aVal = a[sortColumn as keyof IVehicle];
      const bVal = b[sortColumn as keyof IVehicle];

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal) > String(bVal) ? 1 : -1;
      }

      return sortDescending ? -comparison : comparison;
    });
  }, [vehicles, sortColumn, sortDescending]);

  const getRowMenuProps = React.useCallback(
    (vehicle: IVehicle): IContextualMenuProps => ({
      items: [
        {
          key: 'edit',
          text: 'Edit',
          iconProps: { iconName: 'Edit' },
          onClick: () => onEdit(vehicle),
        },
        {
          key: 'changeStatus',
          text: 'Change Status',
          iconProps: { iconName: 'Sync' },
          onClick: () => onChangeStatus(vehicle),
        },
        {
          key: 'remove',
          text: 'Remove',
          iconProps: { iconName: 'Delete' },
          onClick: () => onRemove(vehicle),
        },
      ],
    }),
    [onEdit, onChangeStatus, onRemove]
  );

  const columns: IColumn[] = React.useMemo(() => {
    const buildColumn = (
      key: string,
      name: string,
      fieldName: string,
      minWidth: number,
      maxWidth: number,
      sortable: boolean
    ): IColumn => ({
      key,
      name,
      fieldName,
      minWidth,
      maxWidth,
      isResizable: true,
      isSorted: sortColumn === fieldName,
      isSortedDescending: sortColumn === fieldName ? sortDescending : false,
      onColumnClick: sortable ? onColumnClick : undefined,
    });

    return [
      {
        key: 'photo',
        name: '',
        fieldName: 'photoUrl',
        minWidth: 40,
        maxWidth: 40,
        isResizable: false,
        onRender: (item: IVehicle) =>
          item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={`${item.make} ${item.model}`}
              style={{
                width: 32,
                height: 32,
                objectFit: 'cover',
                borderRadius: 4,
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                backgroundColor: '#F3F2F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon iconName="Car" styles={{ root: { fontSize: 16, color: '#A19F9D' } }} />
            </div>
          ),
      },
      buildColumn('make', 'Make', 'make', 80, 120, true),
      buildColumn('model', 'Model', 'model', 80, 120, true),
      buildColumn('year', 'Year', 'year', 50, 70, true),
      {
        ...buildColumn('licensePlate', 'License Plate', 'licensePlate', 90, 120, false),
      },
      {
        ...buildColumn('locationName', 'Location', 'locationName', 80, 140, false),
      },
      {
        ...buildColumn('categoryName', 'Category', 'categoryName', 70, 120, false),
      },
      {
        ...buildColumn('capacity', 'Capacity', 'capacity', 60, 80, false),
      },
      {
        key: 'status',
        name: 'Status',
        fieldName: 'status',
        minWidth: 90,
        maxWidth: 120,
        isResizable: true,
        onRender: (item: IVehicle) => <StatusBadge status={item.status} />,
      },
      {
        key: 'actions',
        name: '',
        fieldName: '',
        minWidth: 40,
        maxWidth: 40,
        isResizable: false,
        onRender: (item: IVehicle) => (
          <IconButton
            menuIconProps={{ iconName: 'MoreVertical' }}
            menuProps={getRowMenuProps(item)}
            title="Actions"
            ariaLabel="Actions"
          />
        ),
      },
    ];
  }, [sortColumn, sortDescending, onColumnClick, getRowMenuProps]);

  return (
    <DetailsList
      items={sortedItems}
      columns={columns}
      selectionMode={SelectionMode.none}
      layoutMode={DetailsListLayoutMode.justified}
      isHeaderVisible={true}
    />
  );
};
