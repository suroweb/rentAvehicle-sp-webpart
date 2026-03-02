import { z } from 'zod';

/**
 * Full location record as returned from the database.
 * vehicleCount is populated by join queries for the admin locations list.
 */
export interface ILocation {
  id: number;
  name: string;
  isActive: boolean;
  /** IANA timezone identifier (e.g. 'Europe/Bucharest'). Optional since existing locations may not have it until migrated. */
  timezone?: string;
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

/**
 * Zod schema for validating timezone update requests.
 * Validates that the timezone string is a valid IANA identifier by attempting
 * to construct an Intl.DateTimeFormat with it (throws RangeError for invalid timezones).
 */
export const TimezoneUpdateSchema = z.object({
  timezone: z.string().min(1).max(64).refine(
    (tz: string): boolean => {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone identifier' }
  ),
});
