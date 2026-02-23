import * as React from 'react';
import styles from './AppShell.module.scss';
import { IAppShellProps } from './IAppShellProps';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Sidebar } from '../Sidebar/Sidebar';
import { BottomTabBar } from '../BottomTabBar/BottomTabBar';
import { WelcomeScreen } from '../WelcomeScreen/WelcomeScreen';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { FleetManagement } from '../FleetManagement/FleetManagement';
import { ApiService } from '../../services/ApiService';
import { AadHttpClient } from '@microsoft/sp-http';

interface IAppShellContentProps {
  supportContact: string;
  userDisplayName: string;
  apiClient: AadHttpClient | null;
}

const AppShellContent: React.FC<IAppShellContentProps> = ({
  supportContact,
  userDisplayName,
  apiClient,
}) => {
  const auth = useAuth();
  const { isMobile } = useResponsive();
  const [activeNavKey, setActiveNavKey] = React.useState<string>('home');

  const apiService = React.useMemo(() => {
    if (!apiClient) return null;
    return new ApiService(apiClient);
  }, [apiClient]);

  const handleNavigate = (key: string): void => {
    setActiveNavKey(key);
  };

  const renderPage = (navKey: string): React.ReactElement => {
    switch (navKey) {
      case 'home':
        return (
          <>
            <h2 className={styles.welcomeHeading}>
              Welcome, {auth.user ? auth.user.displayName : userDisplayName}!
            </h2>
            <p className={styles.welcomeText}>
              Select a section from the navigation to get started.
            </p>
          </>
        );
      case 'vehicles':
        if (apiService) {
          return <FleetManagement apiService={apiService} />;
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. Fleet management requires an active API connection.
          </p>
        );
      default:
        return (
          <>
            <h2 className={styles.welcomeHeading}>Coming Soon</h2>
            <p className={styles.welcomeText}>
              This section is under development.
            </p>
          </>
        );
    }
  };

  // Loading state: show welcome screen
  if (auth.loading) {
    return <WelcomeScreen userDisplayName={userDisplayName} />;
  }

  // Error state with no user: show error boundary
  if (auth.error && !auth.user) {
    return (
      <ErrorBoundary
        error={auth.error}
        supportContact={supportContact}
      />
    );
  }

  // If we have a user (even with an error -- degraded mode), render the app shell
  if (auth.user) {
    return (
      <div className={`${styles.appShell} ${isMobile ? styles.mobile : ''}`}>
        {!isMobile && (
          <Sidebar
            user={auth.user}
            activeKey={activeNavKey}
            onNavigate={handleNavigate}
          />
        )}
        <main className={styles.contentArea}>
          <div className={styles.contentInner}>
            {auth.error && (
              <div className={styles.degradedBanner}>
                Running with limited functionality. Some features may be unavailable.
              </div>
            )}
            {renderPage(activeNavKey)}
          </div>
        </main>
        {isMobile && (
          <BottomTabBar
            userRole={auth.user.role}
            activeKey={activeNavKey}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    );
  }

  // Fallback: should not reach here, but show error
  return (
    <ErrorBoundary
      error="An unexpected error occurred. Please try again."
      supportContact={supportContact}
    />
  );
};

export const AppShell: React.FC<IAppShellProps> = ({
  apiClient,
  supportContact,
  userDisplayName,
  userEmail,
}) => {
  return (
    <AuthProvider
      apiClient={apiClient}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
    >
      <AppShellContent
        supportContact={supportContact}
        userDisplayName={userDisplayName}
        apiClient={apiClient}
      />
    </AuthProvider>
  );
};
