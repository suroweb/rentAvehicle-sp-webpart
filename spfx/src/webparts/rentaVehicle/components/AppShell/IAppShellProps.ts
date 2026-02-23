import { AadHttpClient } from '@microsoft/sp-http';

export interface IAppShellProps {
  apiClient: AadHttpClient | null;
  isTeams: boolean;
  supportContact: string;
  userDisplayName: string;
  userEmail: string;
}
