import { AadHttpClient } from '@microsoft/sp-http';

export interface IRentaVehicleProps {
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  userEmail: string;
  supportContact: string;
  apiClient: AadHttpClient | undefined;
  isTeams: boolean;
}
