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
      if (!apiClient) {
        // API client initialization failed -- provide fallback user with degraded experience
        const fallbackUser: IUser = {
          userId: '',
          displayName: userDisplayName,
          email: userEmail,
          role: 'Employee' as AppRole,
        };
        if (!cancelled) {
          setAuthState({
            user: fallbackUser,
            loading: false,
            error: 'Failed to initialize API connection. Running with limited functionality.',
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
        // API call failed -- provide fallback user with Employee role
        const fallbackUser: IUser = {
          userId: '',
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
            userId: '',
            displayName: userDisplayName,
            email: userEmail,
            role: 'Employee' as AppRole,
          },
          loading: false,
          error: 'Unexpected error during authentication',
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
