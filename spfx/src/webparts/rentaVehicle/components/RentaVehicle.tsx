import * as React from 'react';
import styles from './RentaVehicle.module.scss';
import type { IRentaVehicleProps } from './IRentaVehicleProps';
import { escape } from '@microsoft/sp-lodash-subset';

export default class RentaVehicle extends React.Component<IRentaVehicleProps> {
  public render(): React.ReactElement<IRentaVehicleProps> {
    const {
      isDarkTheme,
      environmentMessage,
      hasTeamsContext,
      userDisplayName,
      userEmail,
    } = this.props;

    return (
      <section className={`${styles.rentaVehicle} ${hasTeamsContext ? styles.teams : ''}`}>
        <div className={styles.welcome}>
          <img alt="" src={isDarkTheme ? require('../assets/welcome-dark.png') : require('../assets/welcome-light.png')} className={styles.welcomeImage} />
          <h2>Welcome, {escape(userDisplayName)}!</h2>
          <div>{escape(userEmail)}</div>
          <div>{environmentMessage}</div>
        </div>
        <div>
          <h3>RentAVehicle - Internal Vehicle Rental System</h3>
          <p>
            Browse and book vehicles from the company fleet. This app shell will be replaced with the full application in subsequent plans.
          </p>
        </div>
      </section>
    );
  }
}
