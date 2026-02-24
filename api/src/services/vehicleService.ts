/**
 * Vehicle CRUD database operations with location scoping.
 *
 * All queries use parameterized inputs via request.input() to prevent SQL injection.
 * Soft delete pattern: archiveVehicle sets isArchived=1 instead of DELETE FROM.
 */
import sql from 'mssql';
import { getPool } from './database.js';
import { VehicleInput, IVehicle, IVehicleFilters } from '../models/Vehicle.js';

/**
 * Resolves an Admin user's officeLocation string to a Location ID.
 * Returns null if the officeLocation is not found or not active.
 */
export async function resolveLocationIdForAdmin(
  officeLocation: string
): Promise<number | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input('officeLocation', sql.NVarChar(128), officeLocation);

  const result = await request.query(
    'SELECT id FROM Locations WHERE name = @officeLocation AND isActive = 1'
  );

  if (result.recordset.length === 0) {
    return null;
  }

  return result.recordset[0].id;
}

/**
 * List vehicles with optional filters.
 * Joins Categories and Locations for display names.
 * Only returns non-archived vehicles.
 */
export async function getVehicles(
  filters: IVehicleFilters
): Promise<IVehicle[]> {
  const pool = await getPool();
  const request = pool.request();

  let whereClause = 'WHERE v.isArchived = 0';

  if (filters.locationId) {
    request.input('locationId', sql.Int, filters.locationId);
    whereClause += ' AND v.locationId = @locationId';
  }
  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    whereClause += ' AND v.status = @status';
  }
  if (filters.categoryId) {
    request.input('categoryId', sql.Int, filters.categoryId);
    whereClause += ' AND v.categoryId = @categoryId';
  }
  if (filters.search) {
    request.input('search', sql.NVarChar(200), `%${filters.search}%`);
    whereClause +=
      ' AND (v.make LIKE @search OR v.model LIKE @search OR v.licensePlate LIKE @search)';
  }

  const result = await request.query(`
    SELECT
      v.id, v.make, v.model, v.year, v.licensePlate,
      v.locationId, l.name AS locationName,
      v.categoryId, c.name AS categoryName,
      v.capacity, v.photoUrl, v.status,
      v.isArchived, v.archivedAt,
      v.createdAt, v.updatedAt, v.createdBy, v.updatedBy,
      v.resourceMailboxEmail
    FROM Vehicles v
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    ${whereClause}
    ORDER BY v.make, v.model
  `);

  return result.recordset;
}

/**
 * Get a single vehicle by ID with joined category and location names.
 * Returns null if not found or archived.
 */
export async function getVehicleById(id: number): Promise<IVehicle | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.Int, id);

  const result = await request.query(`
    SELECT
      v.id, v.make, v.model, v.year, v.licensePlate,
      v.locationId, l.name AS locationName,
      v.categoryId, c.name AS categoryName,
      v.capacity, v.photoUrl, v.status,
      v.isArchived, v.archivedAt,
      v.createdAt, v.updatedAt, v.createdBy, v.updatedBy,
      v.resourceMailboxEmail
    FROM Vehicles v
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE v.id = @id AND v.isArchived = 0
  `);

  if (result.recordset.length === 0) {
    return null;
  }

  return result.recordset[0];
}

/**
 * Create a new vehicle. Sets status to 'Available' by default.
 * Returns the new vehicle's ID.
 */
export async function createVehicle(
  vehicle: VehicleInput,
  createdBy: string
): Promise<number> {
  const pool = await getPool();
  const request = pool.request();

  request.input('make', sql.NVarChar(100), vehicle.make);
  request.input('model', sql.NVarChar(100), vehicle.model);
  request.input('year', sql.Int, vehicle.year);
  request.input('licensePlate', sql.NVarChar(20), vehicle.licensePlate);
  request.input('locationId', sql.Int, vehicle.locationId);
  request.input('categoryId', sql.Int, vehicle.categoryId);
  request.input('capacity', sql.Int, vehicle.capacity);
  request.input('photoUrl', sql.NVarChar(500), vehicle.photoUrl || null);
  request.input('resourceMailboxEmail', sql.NVarChar(255), vehicle.resourceMailboxEmail || null);
  request.input('status', sql.NVarChar(20), 'Available');
  request.input('createdBy', sql.NVarChar(255), createdBy);

  const result = await request.query(`
    INSERT INTO Vehicles (make, model, year, licensePlate, locationId, categoryId, capacity, photoUrl, resourceMailboxEmail, status, createdBy)
    OUTPUT INSERTED.id
    VALUES (@make, @model, @year, @licensePlate, @locationId, @categoryId, @capacity, @photoUrl, @resourceMailboxEmail, @status, @createdBy)
  `);

  return result.recordset[0].id;
}

/**
 * Update an existing vehicle's editable fields.
 * Returns true if a row was updated, false if not found.
 */
export async function updateVehicle(
  id: number,
  vehicle: VehicleInput,
  updatedBy: string
): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();

  request.input('id', sql.Int, id);
  request.input('make', sql.NVarChar(100), vehicle.make);
  request.input('model', sql.NVarChar(100), vehicle.model);
  request.input('year', sql.Int, vehicle.year);
  request.input('licensePlate', sql.NVarChar(20), vehicle.licensePlate);
  request.input('locationId', sql.Int, vehicle.locationId);
  request.input('categoryId', sql.Int, vehicle.categoryId);
  request.input('capacity', sql.Int, vehicle.capacity);
  request.input('photoUrl', sql.NVarChar(500), vehicle.photoUrl || null);
  request.input('resourceMailboxEmail', sql.NVarChar(255), vehicle.resourceMailboxEmail || null);
  request.input('updatedBy', sql.NVarChar(255), updatedBy);

  const result = await request.query(`
    UPDATE Vehicles
    SET make = @make, model = @model, year = @year, licensePlate = @licensePlate,
        locationId = @locationId, categoryId = @categoryId, capacity = @capacity,
        photoUrl = @photoUrl, resourceMailboxEmail = @resourceMailboxEmail,
        updatedAt = GETUTCDATE(), updatedBy = @updatedBy
    WHERE id = @id AND isArchived = 0
  `);

  return (result.rowsAffected[0] ?? 0) > 0;
}

/**
 * Soft delete a vehicle by setting isArchived=1 and archivedAt timestamp.
 * Returns true if a row was archived, false if not found.
 */
export async function archiveVehicle(
  id: number,
  updatedBy: string
): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();

  request.input('id', sql.Int, id);
  request.input('updatedBy', sql.NVarChar(255), updatedBy);

  const result = await request.query(`
    UPDATE Vehicles
    SET isArchived = 1, archivedAt = GETUTCDATE(), updatedAt = GETUTCDATE(), updatedBy = @updatedBy
    WHERE id = @id AND isArchived = 0
  `);

  return (result.rowsAffected[0] ?? 0) > 0;
}

/**
 * Update a vehicle's status.
 * Does NOT allow status change on archived vehicles.
 * Returns true if a row was updated, false if not found or archived.
 */
/**
 * Update a vehicle's resource mailbox email after Exchange provisioning.
 * This is called by the admin endpoint that links a provisioned Exchange
 * equipment mailbox to a vehicle record.
 * Returns true if a row was updated, false if not found.
 */
export async function updateVehicleMailbox(
  vehicleId: number,
  resourceMailboxEmail: string
): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input('vehicleId', sql.Int, vehicleId)
    .input('resourceMailboxEmail', sql.NVarChar(255), resourceMailboxEmail)
    .query('UPDATE Vehicles SET resourceMailboxEmail = @resourceMailboxEmail, updatedAt = GETUTCDATE() WHERE id = @vehicleId AND isArchived = 0');
  return (result.rowsAffected[0] ?? 0) > 0;
}

/**
 * Update a vehicle's status.
 * Does NOT allow status change on archived vehicles.
 * Returns true if a row was updated, false if not found or archived.
 */
export async function updateVehicleStatus(
  id: number,
  status: string,
  updatedBy: string
): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();

  request.input('id', sql.Int, id);
  request.input('status', sql.NVarChar(20), status);
  request.input('updatedBy', sql.NVarChar(255), updatedBy);

  const result = await request.query(`
    UPDATE Vehicles
    SET status = @status, updatedAt = GETUTCDATE(), updatedBy = @updatedBy
    WHERE id = @id AND isArchived = 0
  `);

  return (result.rowsAffected[0] ?? 0) > 0;
}
