export interface ILocation {
  id: number;
  name: string;
  isActive: boolean;
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
