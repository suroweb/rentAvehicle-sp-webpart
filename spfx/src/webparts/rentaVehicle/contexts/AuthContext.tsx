import * as React from 'react';
import { AadHttpClient } from '@microsoft/sp-http';
import { IUser, AppRole } from '../models/IUser';
import { ApiService } from '../services/ApiService';

export interface IAuthState {
  user: IUser | null;
  loading: boolean;
  error: string | null;
}

const defaultAuthState: IAuthState = {
  user: null,
  loading: true,
  error: null,
};

export const AuthContext = React.createContext<IAuthState>(defaultAuthState);

export interface IAuthProviderProps {
  apiClient: AadHttpClient | null;
  userDisplayName: string;
  userEmail: string;
  children: React.ReactNode;
}

/**
 * Error simulation via URL query parameter: ?simulateError=<type>
 *
 * Auth-level (handled here, blocks app):
 *   auth       — Authentication failed (AAD token / consent error)
 *   network    — Backend API unreachable
 *   permission — 403 Forbidden, user not authorized
 *   notfound   — 404 API endpoint not found
 *   server     — 500 Internal server error
 *   degraded   — API failed but app runs in limited mode
 *
 * Booking-level (handled in BookingForm):
 *   booking       — 409 conflict when confirming a booking
 *   bookingServer — 500 server error when confirming a booking
 *
 * Browse-level (handled in VehicleBrowse):
 *   browseFilters — filter load failure (locations/categories API)
 *   browseSearch  — search API failure after clicking Search
 *   browseEmpty   — search returns zero results
 */
type SimulatedError = 'auth' | 'network' | 'permission' | 'notfound' | 'server' | 'degraded';

const SIMULATED_ERROR_MESSAGES: Record<SimulatedError, string> = {
  auth: 'Authentication failed. Your Azure AD token could not be acquired. Please ensure admin consent has been granted for the RentAVehicle API.',
  network: 'Unable to reach the RentAVehicle API. Please check your network connection and verify the API endpoint is available.',
  permission: 'Access denied (403). You do not have permission to use this application. Contact your administrator to request access.',
  notfound: 'The RentAVehicle API endpoint was not found (404). The backend service may not be deployed or the URL is misconfigured.',
  server: 'The RentAVehicle API returned an internal server error (500). The backend service may be experiencing issues. Please try again later.',
  degraded: 'Could not verify your full permissions. Running with limited functionality — some features may be unavailable.',
};

function getSimulatedError(): SimulatedError | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('simulateError');
    if (value && value in SIMULATED_ERROR_MESSAGES) {
      return value as SimulatedError;
    }
  } catch {
    // ignore — may not have window in SSR
  }
  return null;
}

export const AuthProvider: React.FC<IAuthProviderProps> = ({
  apiClient,
  userDisplayName,
  userEmail,
  children,
}) => {
  const [authState, setAuthState] = React.useState<IAuthState>(defaultAuthState);

  React.useEffect(() => {
    let cancelled = false;

    const fetchUser = async (): Promise<void> => {
      // --- Error simulation ---
      const simError = getSimulatedError();
      if (simError) {
        // Simulate a loading delay so the WelcomeScreen is visible
        await new Promise<void>(resolve => setTimeout(resolve, 1500));
        if (cancelled) return;

        if (simError === 'degraded') {
          // Degraded mode: user is loaded but with an error flag
          setAuthState({
            user: {
              userId: 'local-dev',
              displayName: userDisplayName,
              email: userEmail,
              role: 'Employee' as AppRole,
            },
            loading: false,
            error: SIMULATED_ERROR_MESSAGES[simError],
          });
        } else {
          // Fatal errors: no user, app cannot proceed
          setAuthState({
            user: null,
            loading: false,
            error: SIMULATED_ERROR_MESSAGES[simError],
          });
        }
        return;
      }
      // --- End error simulation ---

      if (!apiClient) {
        // No API client available (local workbench) -- use Employee role for local dev
        const fallbackUser: IUser = {
          userId: 'local-dev',
          displayName: userDisplayName,
          email: userEmail,
          role: 'Employee' as AppRole,
        };
        if (!cancelled) {
          setAuthState({
            user: fallbackUser,
            loading: false,
            error: null,
          });
        }
        return;
      }

      try {
        const apiService = new ApiService(apiClient);
        const user = await apiService.getMe();
        if (!cancelled) {
          setAuthState({
            user,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        // API call failed -- use Employee for local dev fallback
        const fallbackUser: IUser = {
          userId: 'local-dev',
          displayName: userDisplayName,
          email: userEmail,
          role: 'Employee' as AppRole,
        };
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch user identity';
        if (!cancelled) {
          setAuthState({
            user: fallbackUser,
            loading: false,
            error: errorMessage,
          });
        }
      }
    };

    fetchUser().catch(() => {
      // Ensure we never leave in loading state
      if (!cancelled) {
        setAuthState({
          user: {
            userId: 'local-dev',
            displayName: userDisplayName,
            email: userEmail,
            role: 'Employee' as AppRole,
          },
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiClient, userDisplayName, userEmail]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): IAuthState {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
