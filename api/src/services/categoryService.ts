/**
 * Category CRUD database operations.
 *
 * All queries use parameterized inputs via request.input() to prevent SQL injection.
 * Soft delete pattern: archiveCategory sets isActive=0.
 */
import sql from 'mssql';
import { getPool } from './database.js';
import { CategoryInput, ICategory } from '../models/Category.js';

/**
 * List all active categories, ordered by name.
 */
export async function getCategories(): Promise<ICategory[]> {
  const pool = await getPool();
  const request = pool.request();

  const result = await request.query(
    'SELECT id, name, description, isActive, createdAt, updatedAt FROM Categories WHERE isActive = 1 ORDER BY name'
  );

  return result.recordset;
}

/**
 * Create a new category.
 * Returns the new category's ID.
 */
export async function createCategory(input: CategoryInput): Promise<number> {
  const pool = await getPool();
  const request = pool.request();

  request.input('name', sql.NVarChar(100), input.name);
  request.input('description', sql.NVarChar(500), input.description || null);

  const result = await request.query(`
    INSERT INTO Categories (name, description)
    OUTPUT INSERTED.id
    VALUES (@name, @description)
  `);

  return result.recordset[0].id;
}

/**
 * Update an existing category's name and description.
 * Returns true if a row was updated, false if not found.
 */
export async function updateCategory(
  id: number,
  input: CategoryInput
): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();

  request.input('id', sql.Int, id);
  request.input('name', sql.NVarChar(100), input.name);
  request.input('description', sql.NVarChar(500), input.description || null);

  const result = await request.query(`
    UPDATE Categories
    SET name = @name, description = @description, updatedAt = GETUTCDATE()
    WHERE id = @id AND isActive = 1
  `);

  return (result.rowsAffected[0] ?? 0) > 0;
}

/**
 * Soft delete a category by setting isActive=0.
 * Returns true if a row was deactivated, false if not found or already inactive.
 */
export async function archiveCategory(id: number): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();

  request.input('id', sql.Int, id);

  const result = await request.query(`
    UPDATE Categories
    SET isActive = 0, updatedAt = GETUTCDATE()
    WHERE id = @id AND isActive = 1
  `);

  return (result.rowsAffected[0] ?? 0) > 0;
}
