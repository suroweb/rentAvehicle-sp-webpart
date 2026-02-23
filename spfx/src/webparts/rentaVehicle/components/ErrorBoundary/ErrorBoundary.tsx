import * as React from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './ErrorBoundary.module.scss';

export interface IErrorBoundaryProps {
  error: string;
  supportContact: string;
  onRetry?: () => void;
}

export const ErrorBoundary: React.FC<IErrorBoundaryProps> = ({
  error,
  supportContact,
  onRetry,
}) => {
  const handleRetry = (): void => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const renderSupportLink = (): React.ReactElement | null => {
    if (!supportContact) {
      return null;
    }

    // Detect if supportContact is an email or URL
    const isEmail = supportContact.includes('@') && !supportContact.startsWith('http');
    const href = isEmail ? `mailto:${supportContact}` : supportContact;

    return (
      <div className={styles.supportSection}>
        <span className={styles.supportLabel}>Need help? Contact IT support:</span>
        <a href={href} className={styles.supportLink} target="_blank" rel="noopener noreferrer">
          {supportContact}
        </a>
      </div>
    );
  };

  return (
    <div className={styles.errorBoundary}>
      <div className={styles.content}>
        <Icon iconName="Car" className={styles.logo} />
        <h2 className={styles.title}>RentAVehicle</h2>

        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={true}
          className={styles.messageBar}
        >
          <strong>Authentication Error</strong>
          <p className={styles.errorMessage}>{error}</p>
        </MessageBar>

        <PrimaryButton
          text="Try Again"
          onClick={handleRetry}
          iconProps={{ iconName: 'Refresh' }}
          className={styles.retryButton}
        />

        {renderSupportLink()}
      </div>
    </div>
  );
};
