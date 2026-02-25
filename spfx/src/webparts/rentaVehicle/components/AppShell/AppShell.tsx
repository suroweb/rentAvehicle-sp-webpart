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
import { CategoryManagement } from '../CategoryManagement/CategoryManagement';
import { LocationList } from '../LocationList/LocationList';
import { VehicleBrowse } from '../VehicleBrowse/VehicleBrowse';
import { VehicleDetail } from '../VehicleDetail/VehicleDetail';
import { MyBookings } from '../MyBookings/MyBookings';
import { AllBookings } from '../AllBookings/AllBookings';
import { Reports } from '../Reports/Reports';
import { TeamBookings } from '../TeamBookings/TeamBookings';
import { ApiService } from '../../services/ApiService';
import { ILocation } from '../../models/ILocation';
import { ICategory } from '../../models/ICategory';
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
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);

  const apiService = React.useMemo(() => {
    return new ApiService(apiClient || null);
  }, [apiClient]);

  // Locations and categories loaded for admin pages (AllBookings, Reports)
  const [adminLocations, setAdminLocations] = React.useState<ILocation[]>([]);
  const [adminCategories, setAdminCategories] = React.useState<ICategory[]>([]);
  React.useEffect(() => {
    if (auth.user && (auth.user.role === 'Admin' || auth.user.role === 'SuperAdmin') && apiService) {
      apiService.getLocations()
        .then((locs: ILocation[]) => { setAdminLocations(locs); })
        .catch(() => { /* Locations load failure is non-blocking */ });
      apiService.getCategories()
        .then((cats: ICategory[]) => { setAdminCategories(cats); })
        .catch(() => { /* Categories load failure is non-blocking */ });
    }
  }, [auth.user, apiService]);

  const handleNavigate = (key: string): void => {
    setActiveNavKey(key);
    setSelectedVehicleId(null);
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
      case 'categories':
        if (apiService) {
          return <CategoryManagement apiService={apiService} />;
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. Category management requires an active API connection.
          </p>
        );
      case 'locations':
        if (apiService && auth.user) {
          return <LocationList apiService={apiService} userRole={auth.user.role} />;
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. Location management requires an active API connection.
          </p>
        );
      case 'browse':
        if (apiService) {
          if (selectedVehicleId !== null) {
            return (
              <VehicleDetail
                vehicleId={selectedVehicleId}
                apiService={apiService}
                currentUserId={auth.user ? auth.user.userId : ''}
                onBack={() => setSelectedVehicleId(null)}
                onNavigateToMyBookings={() => {
                  setSelectedVehicleId(null);
                  setActiveNavKey('myBookings');
                }}
                onNavigateToVehicle={(id: number) => setSelectedVehicleId(id)}
              />
            );
          }
          return (
            <VehicleBrowse
              apiService={apiService}
              onNavigateToDetail={(id: number) => setSelectedVehicleId(id)}
              userOfficeLocation={auth.user ? auth.user.officeLocation : null}
            />
          );
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. Browse requires an active API connection.
          </p>
        );
      case 'myBookings':
        if (apiService) {
          return (
            <MyBookings
              apiService={apiService}
              onNavigateToBrowse={() => { setActiveNavKey('browse'); }}
            />
          );
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. My Bookings requires an active API connection.
          </p>
        );
      case 'allBookings':
        if (apiService) {
          return (
            <AllBookings
              apiService={apiService}
              locations={adminLocations}
            />
          );
        }
        return (
          <p className={styles.welcomeText}>
            API connection is not available. All Bookings requires an active API connection.
          </p>
        );
      case 'reports':
        if (apiService) {
          return (
            <Reports
              apiService={apiService}
              locations={adminLocations}
              categories={adminCategories}
            />
          );
        }
        return (
          <p className={styles.welcomeText}>
            API connection not available.
          </p>
        );
      case 'teamBookings':
        if (apiService) {
          return <TeamBookings apiService={apiService} />;
        }
        return <p className={styles.welcomeText}>API connection not available.</p>;
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
