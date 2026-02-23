import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './VehicleBrowse.module.scss';
import { IAvailableVehicle } from '../../models/IBooking';

export interface IVehicleCardProps {
  vehicle: IAvailableVehicle;
  timezone: string;
  onSelect: (vehicleId: number) => void;
}

export const VehicleCard: React.FC<IVehicleCardProps> = ({
  vehicle,
  onSelect,
}) => {
  const handleClick = React.useCallback((): void => {
    onSelect(vehicle.id);
  }, [vehicle.id, onSelect]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(vehicle.id);
      }
    },
    [vehicle.id, onSelect]
  );

  return (
    <div
      className={styles.vehicleCard}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${vehicle.make} ${vehicle.model} ${vehicle.year}`}
    >
      {/* Photo or placeholder */}
      <div className={styles.cardPhoto}>
        {vehicle.photoUrl ? (
          <img
            src={vehicle.photoUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardPlaceholder}>
            <Icon iconName="Car" className={styles.placeholderIcon} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        {/* Title: Make Model Year */}
        <h3 className={styles.cardTitle}>
          {vehicle.make} {vehicle.model} {vehicle.year}
        </h3>

        {/* Category badge */}
        <span className={styles.categoryBadge}>{vehicle.categoryName}</span>

        {/* Details row */}
        <div className={styles.cardDetails}>
          <span className={styles.capacityInfo}>
            <Icon iconName="People" className={styles.detailIcon} />
            {vehicle.capacity} seats
          </span>
          <span className={styles.licensePlate}>{vehicle.licensePlate}</span>
        </div>

        {/* Availability indicator */}
        <div className={styles.availabilityIndicator}>
          <span className={styles.availabilityDot} />
          <span className={styles.availabilityText}>Available</span>
        </div>
      </div>
    </div>
  );
};
