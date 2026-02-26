import { AadHttpClient } from '@microsoft/sp-http';

export interface IAppShellProps {
  apiClient: AadHttpClient | null;
  isTeams: boolean;
  initialNav?: string;
  supportContact: string;
  userDisplayName: string;
  userEmail: string;
}
