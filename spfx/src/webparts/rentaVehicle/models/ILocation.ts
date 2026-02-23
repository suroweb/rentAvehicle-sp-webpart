export interface ILocation {
  id: number;
  name: string;
  isActive: boolean;
  /** IANA timezone identifier (e.g. 'Europe/Bucharest'). */
  timezone?: string;
  vehicleCount?: number;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ILocationSyncResult {
  added: number;
  deactivated: number;
  total: number;
}
