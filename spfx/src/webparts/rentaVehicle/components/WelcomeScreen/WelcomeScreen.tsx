import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './WelcomeScreen.module.scss';

export interface IWelcomeScreenProps {
  userDisplayName: string;
}

export const WelcomeScreen: React.FC<IWelcomeScreenProps> = ({ userDisplayName }) => {
  return (
    <div className={styles.welcomeScreen}>
      <div className={styles.content}>
        <div className={styles.branding}>
          <Icon iconName="Car" className={styles.logo} />
          <h1 className={styles.appName}>RentAVehicle</h1>
        </div>
        <h2 className={styles.greeting}>
          Welcome, {userDisplayName}!
        </h2>
        <Spinner
          size={SpinnerSize.large}
          label="Loading your workspace..."
          className={styles.spinner}
        />
      </div>
    </div>
  );
};
