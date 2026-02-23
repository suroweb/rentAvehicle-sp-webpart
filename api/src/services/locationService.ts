/**
 * Location query and sync operations.
 *
 * Handles syncing locations from Entra ID (via graphService), querying
 * locations with vehicle counts, and lazy-sync on first access or stale data.
 */
import sql from 'mssql';
import { getPool } from './database.js';
import { ILocation, ILocationSyncResult } from '../models/Location.js';
import { getDistinctOfficeLocations } from './graphService.js';

/**
 * Get all locations with a count of non-archived vehicles per location.
 * Returns ILocation[] with vehicleCount populated.
 */
export async function getLocationsWithVehicleCounts(): Promise<ILocation[]> {
  const pool = await getPool();
  const request = pool.request();

  const result = await request.query(`
    SELECT
      l.id, l.name, l.isActive, l.lastSyncedAt, l.createdAt, l.updatedAt,
      COUNT(v.id) AS vehicleCount
    FROM Locations l
    LEFT JOIN Vehicles v ON l.id = v.locationId AND v.isArchived = 0
    GROUP BY l.id, l.name, l.isActive, l.lastSyncedAt, l.createdAt, l.updatedAt
    ORDER BY l.name
  `);

  return result.recordset;
}

/**
 * Sync locations from Entra ID office locations.
 *
 * Logic:
 * a. Get all existing location names from DB.
 * b. For each officeLocation not in DB: INSERT new Location.
 * c. For each DB location not in officeLocations: SET isActive=0 (deactivated).
 * d. For each DB location that IS in officeLocations AND was inactive: SET isActive=1 (reactivated).
 * e. Update lastSyncedAt for all matched locations.
 * f. Return sync result counts.
 */
export async function syncLocations(
  officeLocations: string[]
): Promise<ILocationSyncResult> {
  const pool = await getPool();

  // Get existing locations from DB
  const existingResult = await pool
    .request()
    .query('SELECT id, name, isActive FROM Locations');

  const existingMap = new Map<string, { id: number; isActive: boolean }>();
  for (const row of existingResult.recordset) {
    existingMap.set(row.name, { id: row.id, isActive: row.isActive });
  }

  const officeLocationSet = new Set(officeLocations);
  let added = 0;
  let deactivated = 0;

  // b. Insert new locations
  for (const location of officeLocations) {
    if (!existingMap.has(location)) {
      const insertReq = pool.request();
      insertReq.input('name', sql.NVarChar(128), location);
      await insertReq.query(
        'INSERT INTO Locations (name, isActive, lastSyncedAt) VALUES (@name, 1, GETUTCDATE())'
      );
      added++;
    }
  }

  // c. Deactivate locations no longer in Entra ID
  // d. Reactivate locations that reappeared
  // e. Update lastSyncedAt for matched locations
  for (const [name, existing] of existingMap) {
    if (!officeLocationSet.has(name)) {
      // Location disappeared from Entra ID -- deactivate
      if (existing.isActive) {
        const deactReq = pool.request();
        deactReq.input('id', sql.Int, existing.id);
        await deactReq.query(
          'UPDATE Locations SET isActive = 0, updatedAt = GETUTCDATE() WHERE id = @id'
        );
        deactivated++;
      }
    } else {
      // Location still in Entra ID -- reactivate if inactive, update lastSyncedAt
      const updateReq = pool.request();
      updateReq.input('id', sql.Int, existing.id);
      await updateReq.query(
        'UPDATE Locations SET isActive = 1, lastSyncedAt = GETUTCDATE(), updatedAt = GETUTCDATE() WHERE id = @id'
      );
    }
  }

  // Total = existing (after deactivations/reactivations) + newly added
  const totalResult = await pool
    .request()
    .query('SELECT COUNT(*) AS total FROM Locations WHERE isActive = 1');
  const total = totalResult.recordset[0].total;

  return { added, deactivated, total };
}

/**
 * Lazy-sync: ensures locations are synced on first access or when stale (>24h).
 *
 * Checks the most recent lastSyncedAt. If no rows exist (first run) or the
 * most recent sync is older than 24 hours, automatically fetches office
 * locations from Graph API and syncs them.
 *
 * If the Graph API call fails (e.g., missing credentials in dev), logs a
 * warning and continues -- does not block the response.
 *
 * Safe to call concurrently (idempotent upserts).
 */
export async function ensureLocationsSynced(): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query(
        'SELECT TOP 1 lastSyncedAt FROM Locations ORDER BY lastSyncedAt DESC'
      );

    const needsSync =
      result.recordset.length === 0 || isStale(result.recordset[0].lastSyncedAt);

    if (!needsSync) {
      return;
    }

    console.log('Location sync triggered: fetching office locations from Graph API...');
    const officeLocations = await getDistinctOfficeLocations();
    const syncResult = await syncLocations(officeLocations);
    console.log(
      `Location sync complete: ${syncResult.added} added, ${syncResult.deactivated} deactivated, ${syncResult.total} total active`
    );
  } catch (error) {
    // Do not block the response if Graph API fails (e.g., missing credentials in dev)
    console.warn(
      'Location auto-sync failed (Graph API may not be configured):',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Check if a lastSyncedAt timestamp is older than 24 hours.
 */
function isStale(lastSyncedAt: Date | string): boolean {
  const syncTime =
    lastSyncedAt instanceof Date
      ? lastSyncedAt
      : new Date(lastSyncedAt);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return syncTime < twentyFourHoursAgo;
}
