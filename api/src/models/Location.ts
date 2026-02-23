/**
 * Full location record as returned from the database.
 * vehicleCount is populated by join queries for the admin locations list.
 */
export interface ILocation {
  id: number;
  name: string;
  isActive: boolean;
  vehicleCount?: number;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a location sync operation from Entra ID.
 */
export interface ILocationSyncResult {
  added: number;
  deactivated: number;
  total: number;
}
