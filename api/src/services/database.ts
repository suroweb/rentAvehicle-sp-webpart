/**
 * Singleton connection pool for Azure SQL.
 *
 * Supports two authentication modes:
 * - SQL auth (local dev): when AZURE_SQL_USER env var is set, uses username/password
 * - Azure AD auth (production): uses azure-active-directory-default with Managed Identity
 *
 * The pool is created once and reused across Azure Functions invocations
 * within the same host instance (warm start).
 */
import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

/**
 * Returns the singleton Azure SQL connection pool.
 * Creates the pool on first call; returns the existing pool on subsequent calls.
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  const useSqlAuth = !!process.env.AZURE_SQL_USER;

  const baseConfig = {
    server: process.env.AZURE_SQL_SERVER || '',
    database: process.env.AZURE_SQL_DATABASE || '',
    port: parseInt(process.env.AZURE_SQL_PORT || '1433', 10),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  let config: sql.config;

  if (useSqlAuth) {
    // Local development: SQL Server authentication
    config = {
      ...baseConfig,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: true, // Allow self-signed certs locally
      },
    };
  } else {
    // Production: Azure Active Directory default (Managed Identity)
    config = {
      ...baseConfig,
      authentication: {
        type: 'azure-active-directory-default',
        options: {
          clientId: undefined,
        },
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    };
  }

  pool = await sql.connect(config);
  return pool;
}
