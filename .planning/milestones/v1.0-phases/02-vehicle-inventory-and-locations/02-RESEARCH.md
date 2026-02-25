# Phase 2: Vehicle Inventory and Locations - Research

**Researched:** 2026-02-23
**Domain:** Azure SQL database integration, CRUD API patterns, Microsoft Graph location sync, Fluent UI data tables, image upload, admin scoping (SuperAdmin role)
**Confidence:** HIGH

## Summary

Phase 2 introduces the application's first data layer (Azure SQL) and first Microsoft Graph integration (location sync from Entra ID). The phase requires building a complete CRUD workflow for vehicle management -- database schema, API endpoints, and admin UI -- plus syncing company office locations from Entra ID's `officeLocation` user property and displaying them as read-only selectable locations.

The technical domain involves three major subsystems: (1) Azure SQL database with the `mssql` npm package for vehicle and location data persistence, connected to Azure Functions, (2) Microsoft Graph API with application permissions (`User.Read.All`) to extract distinct `officeLocation` values from the tenant's users, and (3) Fluent UI v8 `DetailsList` component for the fleet management data table with sorting, filtering, and inline status badges.

The most significant technical decision is the photo storage approach. Azure Blob Storage with SAS token upload is the production-grade pattern, but for Phase 2 (admin-only vehicle management, no public browsing), a simpler approach of storing photo URLs or base64-encoded thumbnails in the database may be sufficient. The Valet Key pattern (API generates short-lived SAS token, browser uploads directly to Blob Storage) is the correct architecture for scale.

**Primary recommendation:** Create Azure SQL schema for vehicles, categories, and locations. Build CRUD API endpoints with role-based access control. Implement Graph API location sync as a server-side function. Use Fluent UI DetailsList for the fleet table and a full-page form for add/edit. Add the SuperAdmin app role to the existing Entra ID configuration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Data table layout -- rows with columns, sortable and filterable
- Full filter bar: location, status, category, and free-text search across make/model/plate
- Small vehicle thumbnail in first column for visual identification
- Row actions menu (three-dot) for Edit, Change Status, Remove
- No click-through detail panel -- actions accessible via row menu
- Full page form for add/edit (navigates away from fleet table)
- Single photo upload per vehicle
- Admin-defined vehicle categories -- admins can create/edit category list (needs category management UI)
- Soft delete for vehicle removal -- archived and hidden, data retained, can be restored
- Four statuses: Available, In Maintenance, Retired, Reserved (auto-set when booked)
- All status changes require confirmation dialog explaining what will happen
- Retired is reversible -- admin can bring a retired vehicle back to available
- Colored badge pills in fleet table: green=available, yellow=maintenance, red=retired, blue=reserved
- Locations auto-synced from Entra ID, read-only (no custom locations)
- Sync triggers: on app startup + manual "Sync Locations" button for admins
- Dedicated locations list view in admin showing all synced offices with vehicle counts per location
- If a location disappears from Entra ID, vehicles assigned there are flagged for reassignment -- admin must move them to another location
- New "SuperAdmin" Entra ID app role (4th role alongside Employee, Manager, Admin)
- Location Admin: sees and manages only vehicles at their own office (determined by Entra ID officeLocation attribute)
- Super Admin: full control everywhere -- can add/edit/remove vehicles at any location, view all locations
- Location admins have no visibility into other locations

### Claude's Discretion
- Exact table column order and default sort
- Form field layout and validation messaging
- Category management UI approach (inline vs separate page)
- Confirmation dialog wording
- Sync error handling and retry behavior
- How to handle vehicles with no photo

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VHCL-01 | Admin can add a new vehicle (make, model, year, license plate, location, category, capacity, photo) | Azure SQL `Vehicles` table with all fields. POST `/api/backoffice/vehicles` endpoint with zod validation. Fluent UI full-page form with `TextField`, `Dropdown`, `SpinButton`, and file upload. |
| VHCL-02 | Admin can edit vehicle details | PUT `/api/backoffice/vehicles/:id` endpoint. Same form pre-populated with existing data. Parameterized SQL queries via `mssql` package. |
| VHCL-03 | Admin can remove a vehicle from the fleet | Soft delete -- `isArchived = 1` + `archivedAt` timestamp in SQL. DELETE `/api/backoffice/vehicles/:id` sets archive flag. Confirmation dialog before action. |
| VHCL-04 | Admin can set vehicle status (available, in maintenance, retired) | PATCH `/api/backoffice/vehicles/:id/status` endpoint. Status enum column in SQL. Confirmation dialog explains impact (e.g., "Vehicle will no longer appear in employee browsing"). |
| VHCL-05 | Vehicles not in "available" status are excluded from employee browsing | SQL WHERE clause `status = 'Available' AND isArchived = 0` on employee-facing queries (Phase 3). Status filtering built into the data model now. |
| M365-04 | Locations synced from Entra ID (officeLocation or organizational data) | Azure Functions endpoint calls Graph API `/users?$select=officeLocation` with `User.Read.All` application permission. Extracts distinct non-null officeLocation values. Stores in `Locations` table. Sync on startup + manual trigger. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mssql | 11.x | Azure SQL client for Node.js | Official Microsoft-recommended package. Built on Tedious TDS driver. Includes connection pooling, parameterized queries, and Azure AD authentication. |
| @azure/identity | 4.x | Token acquisition for Azure services | Provides `DefaultAzureCredential` for passwordless Azure SQL auth (managed identity in prod, Azure CLI locally). Also used for Graph API auth. |
| @microsoft/microsoft-graph-client | 3.x | Microsoft Graph SDK for Node.js | Official SDK for Graph API calls. Works with `@azure/identity` for app-only access. |
| @fluentui/react | 8.x (existing) | DetailsList, Dialog, TextField, Dropdown | Already installed in SPFx project. DetailsList is the standard data table component with built-in sorting, column resizing, and selection. |
| zod | 3.x (existing) | Request/response validation | Already installed in API. Use for vehicle form validation on both client and server. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @azure/storage-blob | 12.x | Azure Blob Storage SDK | For vehicle photo upload. Generates SAS tokens server-side, browser uploads directly to Blob Storage. |
| @fluentui/react (Dialog) | 8.x | Confirmation dialogs | For status change and delete confirmations. Already part of Fluent UI v8. |
| @fluentui/react (CommandBar) | 8.x | Filter bar + action buttons | For the fleet table's filter bar with dropdowns, search box, and action buttons. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mssql (direct SQL) | TypeORM or Prisma ORM | ORMs add abstraction but introduce migration complexity and bundle size. For Azure Functions serverless, direct `mssql` with parameterized queries is lighter and gives full control over SQL. Azure Functions cold starts benefit from smaller dependencies. |
| Azure Blob Storage for photos | Base64 in SQL database | Base64 in SQL is simpler to implement but increases database size and query cost. Acceptable for Phase 2 if Blob Storage setup is deferred, but not recommended for production scale. |
| @microsoft/microsoft-graph-client SDK | Direct HTTP fetch to Graph REST API | SDK handles pagination, retries, and type safety. Worth the dependency for production use. |

**Installation (API project):**
```bash
cd api
npm install mssql @azure/identity @microsoft/microsoft-graph-client
npm install -D @types/mssql
```

**Installation (SPFx project):**
```bash
cd spfx
npm install @azure/storage-blob
```

Note: `@fluentui/react` is already installed via SPFx. No additional UI library installation needed.

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
api/
├── src/
│   ├── functions/
│   │   ├── health.ts              # Existing
│   │   ├── me.ts                  # Existing
│   │   ├── vehicles.ts            # NEW: CRUD endpoints for vehicles
│   │   ├── categories.ts          # NEW: CRUD for vehicle categories
│   │   ├── locations.ts           # NEW: Location list + sync trigger
│   │   └── upload.ts              # NEW: SAS token generation for photo upload
│   ├── middleware/
│   │   └── auth.ts                # Existing (update AppRole type to include SuperAdmin)
│   ├── models/
│   │   ├── UserContext.ts          # Existing (update AppRole type)
│   │   ├── Vehicle.ts             # NEW: Vehicle interfaces + zod schemas
│   │   ├── Category.ts            # NEW: Category interfaces
│   │   └── Location.ts            # NEW: Location interfaces
│   ├── services/
│   │   ├── database.ts            # NEW: Connection pool + query helpers
│   │   ├── vehicleService.ts      # NEW: Vehicle CRUD operations
│   │   ├── categoryService.ts     # NEW: Category operations
│   │   ├── locationService.ts     # NEW: Location sync + queries
│   │   └── graphService.ts        # NEW: Graph API client setup
│   ├── sql/
│   │   └── schema.sql             # NEW: Database schema DDL
│   └── index.ts                   # Update: register new function modules
│
spfx/
├── src/webparts/rentaVehicle/
│   ├── components/
│   │   ├── AppShell/              # Existing (update to route to new pages)
│   │   ├── FleetManagement/       # NEW: Fleet table page
│   │   │   ├── FleetManagement.tsx
│   │   │   ├── FleetManagement.module.scss
│   │   │   ├── VehicleTable.tsx   # DetailsList with columns, sort, filter
│   │   │   ├── VehicleFilterBar.tsx # Filter controls
│   │   │   └── StatusBadge.tsx    # Colored status pill component
│   │   ├── VehicleForm/           # NEW: Add/edit vehicle form
│   │   │   ├── VehicleForm.tsx
│   │   │   ├── VehicleForm.module.scss
│   │   │   └── PhotoUpload.tsx    # Single photo upload component
│   │   ├── CategoryManagement/    # NEW: Category CRUD
│   │   │   └── CategoryManagement.tsx
│   │   ├── LocationList/          # NEW: Locations list view
│   │   │   ├── LocationList.tsx
│   │   │   └── LocationList.module.scss
│   │   ├── ConfirmDialog/         # NEW: Reusable confirmation dialog
│   │   │   └── ConfirmDialog.tsx
│   │   └── ...existing components
│   ├── services/
│   │   └── ApiService.ts          # Update: add vehicle, category, location methods
│   ├── models/
│   │   ├── IUser.ts               # Update: add SuperAdmin role
│   │   ├── IVehicle.ts            # NEW: Vehicle interface
│   │   ├── ICategory.ts           # NEW: Category interface
│   │   └── ILocation.ts           # NEW: Location interface
│   └── contexts/
│       └── AuthContext.tsx         # Existing (no changes expected)
```

### Pattern 1: Azure SQL Connection Pool in Azure Functions

**What:** Create a singleton connection pool that persists across function invocations within the same Azure Functions host instance. Azure Functions keeps a single Node.js process alive between invocations (warm start), so a connection pool created at module scope survives across requests.

**When to use:** For all database operations. Never create a new connection per request.

**Example:**
```typescript
// api/src/services/database.ts
// Source: https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart

import sql from 'mssql';

// Singleton pool -- created once, reused across function invocations
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  const config: sql.config = {
    server: process.env.AZURE_SQL_SERVER || '',
    database: process.env.AZURE_SQL_DATABASE || '',
    port: parseInt(process.env.AZURE_SQL_PORT || '1433', 10),
    authentication: {
      type: 'azure-active-directory-default' as any,
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  pool = await sql.connect(config);
  return pool;
}
```

**For local development (SQL auth):**
```typescript
// When AZURE_SQL_AUTHENTICATIONTYPE is not set, fall back to user/pass
const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER || 'localhost',
  database: process.env.AZURE_SQL_DATABASE || 'RentAVehicle',
  port: parseInt(process.env.AZURE_SQL_PORT || '1433', 10),
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true, // Allow self-signed certs locally
  },
};
```

**Confidence: HIGH** -- Verified against [Microsoft Learn: Connect to and query using Node.js and mssql](https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart).

### Pattern 2: Parameterized SQL Queries with mssql

**What:** All SQL queries use parameterized inputs via `request.input()` to prevent SQL injection. Never concatenate user input into SQL strings.

**When to use:** Every database query.

**Example:**
```typescript
// api/src/services/vehicleService.ts
import sql from 'mssql';
import { getPool } from './database.js';

export async function createVehicle(vehicle: IVehicleInput): Promise<number> {
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
  request.input('status', sql.NVarChar(20), 'Available');

  const result = await request.query(`
    INSERT INTO Vehicles (make, model, year, licensePlate, locationId, categoryId, capacity, photoUrl, status)
    OUTPUT INSERTED.id
    VALUES (@make, @model, @year, @licensePlate, @locationId, @categoryId, @capacity, @photoUrl, @status)
  `);

  return result.recordset[0].id;
}

export async function getVehicles(filters: IVehicleFilters): Promise<IVehicle[]> {
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
    whereClause += ' AND (v.make LIKE @search OR v.model LIKE @search OR v.licensePlate LIKE @search)';
  }

  const result = await request.query(`
    SELECT v.*, c.name AS categoryName, l.name AS locationName
    FROM Vehicles v
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    ${whereClause}
    ORDER BY v.make, v.model
  `);

  return result.recordset;
}
```

**Confidence: HIGH** -- Standard parameterized query pattern from mssql documentation.

### Pattern 3: Graph API Location Sync (Server-Side, Application Permissions)

**What:** Azure Functions uses application permissions (client credentials flow) to call Microsoft Graph API and extract distinct `officeLocation` values from all users. Since Graph API has no `$distinct` operator, the function fetches all users with `$select=officeLocation`, handles pagination, and deduplicates server-side.

**When to use:** For the location sync function -- called on app startup and via manual admin trigger.

**Example:**
```typescript
// api/src/services/graphService.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential } from '@azure/identity';

async function getGraphClient(): Promise<Client> {
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.token);
    },
  });
}

export async function getDistinctOfficeLocations(): Promise<string[]> {
  const client = await getGraphClient();
  const locations = new Set<string>();

  let nextLink: string | undefined = '/users?$select=officeLocation&$top=999';

  while (nextLink) {
    const response = await client.api(nextLink).get();

    for (const user of response.value) {
      if (user.officeLocation) {
        locations.add(user.officeLocation.trim());
      }
    }

    nextLink = response['@odata.nextLink']
      ? response['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
      : undefined;
  }

  return Array.from(locations).sort();
}
```

**Graph API configuration needed:**
- Application permission: `User.Read.All` (application, not delegated)
- Granted via: Azure portal > App registrations > API permissions > Microsoft Graph > Application permissions
- Admin consent required: Yes (Global Admin or Privileged Role Administrator)

**Important:** `officeLocation` is returned by default in the user list response (no need for `$select`, but using it reduces payload size). The property is a free-text string (max 128 chars) -- values may have inconsistent casing or formatting across users. Deduplication should normalize (trim, optionally case-normalize).

**Confidence: HIGH** -- Verified against [Microsoft Learn: List users](https://learn.microsoft.com/en-us/graph/api/user-list) and [Tutorial: Access Microsoft Graph as the app](https://learn.microsoft.com/en-us/azure/app-service/tutorial-connect-app-access-microsoft-graph-as-app-javascript).

### Pattern 4: Fluent UI DetailsList with Sorting and Filtering

**What:** The `DetailsList` component from `@fluentui/react` renders the fleet management table. Sorting is handled via `onColumnClick` which updates state with sorted data. Filtering is external (filter bar above the table updates the items array).

**When to use:** For the fleet management table.

**Example:**
```tsx
// Source: Composite from Fluent UI v8 docs + community patterns
import { DetailsList, IColumn, Selection, SelectionMode, DetailsListLayoutMode } from '@fluentui/react/lib/DetailsList';
import { IconButton, IContextualMenuProps } from '@fluentui/react';

const columns: IColumn[] = [
  {
    key: 'photo',
    name: '',
    minWidth: 40,
    maxWidth: 40,
    onRender: (item: IVehicle) => (
      <img src={item.photoUrl || '/placeholder.png'} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
    ),
  },
  {
    key: 'make',
    name: 'Make',
    fieldName: 'make',
    minWidth: 80,
    maxWidth: 120,
    isSorted: false,
    isSortedDescending: false,
    onColumnClick: onColumnClick, // handler that sorts
  },
  {
    key: 'model',
    name: 'Model',
    fieldName: 'model',
    minWidth: 80,
    maxWidth: 120,
  },
  {
    key: 'status',
    name: 'Status',
    fieldName: 'status',
    minWidth: 80,
    maxWidth: 100,
    onRender: (item: IVehicle) => <StatusBadge status={item.status} />,
  },
  {
    key: 'actions',
    name: '',
    minWidth: 40,
    maxWidth: 40,
    onRender: (item: IVehicle) => (
      <IconButton
        menuIconProps={{ iconName: 'MoreVertical' }}
        menuProps={getRowMenuProps(item)}
      />
    ),
  },
];

// Sorting handler
function onColumnClick(ev: React.MouseEvent, column: IColumn): void {
  const sortedItems = [...items].sort((a, b) => {
    const aVal = a[column.fieldName as keyof IVehicle];
    const bVal = b[column.fieldName as keyof IVehicle];
    return column.isSortedDescending
      ? (bVal > aVal ? 1 : -1)
      : (aVal > bVal ? 1 : -1);
  });
  // Update state with new sort direction and sorted items
}
```

**Confidence: HIGH** -- Fluent UI v8 DetailsList is well-documented and already available in the SPFx project.

### Pattern 5: SuperAdmin Role Extension

**What:** Add a 4th app role `SuperAdmin` to the existing Entra ID app registration and update the role hierarchy in both API and SPFx code.

**API-side changes:**
```typescript
// api/src/models/UserContext.ts -- UPDATE
export type AppRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Employee';

// api/src/middleware/auth.ts -- UPDATE resolveEffectiveRole
const ROLE_HIERARCHY: Record<string, number> = {
  Employee: 0,
  Manager: 1,
  Admin: 2,
  SuperAdmin: 3,
};

function resolveEffectiveRole(roles: string[]): AppRole {
  if (roles.includes('SuperAdmin')) return 'SuperAdmin';
  if (roles.includes('Admin')) return 'Admin';
  if (roles.includes('Manager')) return 'Manager';
  return 'Employee';
}
```

**SPFx-side changes:**
```typescript
// spfx models/IUser.ts -- UPDATE
export type AppRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Employee';

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  Employee: 0,
  Manager: 1,
  Admin: 2,
  SuperAdmin: 3,
};
```

**Entra ID app registration -- add to appRoles:**
```json
{
  "allowedMemberTypes": ["User"],
  "description": "Full cross-location administrative access to RentAVehicle",
  "displayName": "SuperAdmin",
  "id": "<unique-guid>",
  "isEnabled": true,
  "value": "SuperAdmin"
}
```

**Location-scoped access pattern:**
- Location Admin (`Admin` role): API filters vehicles by the user's `officeLocation` claim from the token. The `officeLocation` claim must be extracted from the `x-ms-client-principal` header (it is included in the claims array if the `optional_claims` configuration includes it, or the API queries Graph for the user's profile).
- SuperAdmin (`SuperAdmin` role): No location filter applied -- sees all vehicles.

**Important consideration:** The `officeLocation` attribute is NOT included in the standard `x-ms-client-principal` claims by default. Two approaches:
1. Configure optional claims in the app registration to include `office` in the ID/access token
2. Have the API call Graph API (`/me` or `/users/{id}`) with the user's token to get their `officeLocation`

Approach 2 is more reliable and doesn't require token configuration changes. The API can cache the user's officeLocation for the session duration.

**Confidence: HIGH** for role hierarchy. **MEDIUM** for officeLocation claim extraction -- needs validation of optional claims configuration.

### Pattern 6: Azure SQL Database Schema

**What:** Normalized relational schema for vehicles, categories, and locations.

```sql
-- api/src/sql/schema.sql

-- Locations synced from Entra ID
CREATE TABLE Locations (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(128) NOT NULL UNIQUE,  -- officeLocation value from Entra ID
  isActive BIT NOT NULL DEFAULT 1,      -- 0 if removed from Entra ID
  lastSyncedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Admin-defined vehicle categories
CREATE TABLE Categories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL UNIQUE,   -- e.g., 'Sedan', 'SUV', 'Van'
  description NVARCHAR(500) NULL,
  isActive BIT NOT NULL DEFAULT 1,
  createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Vehicle inventory
CREATE TABLE Vehicles (
  id INT IDENTITY(1,1) PRIMARY KEY,
  make NVARCHAR(100) NOT NULL,
  model NVARCHAR(100) NOT NULL,
  year INT NOT NULL,
  licensePlate NVARCHAR(20) NOT NULL UNIQUE,
  locationId INT NOT NULL REFERENCES Locations(id),
  categoryId INT NOT NULL REFERENCES Categories(id),
  capacity INT NOT NULL DEFAULT 5,
  photoUrl NVARCHAR(500) NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available', 'InMaintenance', 'Retired', 'Reserved')),
  isArchived BIT NOT NULL DEFAULT 0,
  archivedAt DATETIME2 NULL,
  createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  createdBy NVARCHAR(255) NULL,
  updatedBy NVARCHAR(255) NULL
);

-- Indexes for common queries
CREATE INDEX IX_Vehicles_LocationId ON Vehicles(locationId);
CREATE INDEX IX_Vehicles_CategoryId ON Vehicles(categoryId);
CREATE INDEX IX_Vehicles_Status ON Vehicles(status) WHERE isArchived = 0;
CREATE INDEX IX_Vehicles_IsArchived ON Vehicles(isArchived);
```

**Confidence: HIGH** -- Standard normalized relational schema.

### Pattern 7: API Route Structure

**What:** RESTful API endpoints under `/api/backoffice/` prefix (established in Phase 1 -- Azure Functions reserves `/admin`).

```
# Vehicle CRUD (Admin/SuperAdmin only)
GET    /api/backoffice/vehicles           # List vehicles (with query params for filters)
GET    /api/backoffice/vehicles/:id       # Get single vehicle
POST   /api/backoffice/vehicles           # Create vehicle
PUT    /api/backoffice/vehicles/:id       # Update vehicle
DELETE /api/backoffice/vehicles/:id       # Soft delete (archive)
PATCH  /api/backoffice/vehicles/:id/status # Change status

# Categories (Admin/SuperAdmin only)
GET    /api/backoffice/categories         # List categories
POST   /api/backoffice/categories         # Create category
PUT    /api/backoffice/categories/:id     # Update category
DELETE /api/backoffice/categories/:id     # Soft delete category

# Locations (read for Admin, sync for SuperAdmin)
GET    /api/backoffice/locations          # List locations (with vehicle counts)
POST   /api/backoffice/locations/sync     # Trigger Entra ID sync (SuperAdmin only)

# Photo upload
POST   /api/backoffice/vehicles/upload-url  # Generate SAS upload URL
```

**Location-scoped filtering:**
- When `effectiveRole === 'Admin'`, the vehicles list endpoint automatically filters by the user's `officeLocation`
- When `effectiveRole === 'SuperAdmin'`, no location filter is applied
- The `locationId` filter param is still available for SuperAdmins to filter by specific location

### Anti-Patterns to Avoid

- **Opening a new SQL connection per request:** Use the singleton connection pool pattern. Azure Functions reuses the same Node.js process -- creating connections in each invocation causes connection exhaustion and slow cold starts.
- **Storing photos as Base64 in SQL:** While quick to implement, this bloats the database and makes queries slower. Use Azure Blob Storage with SAS tokens for any non-trivial deployment.
- **Trusting client-side location filtering as security:** The API MUST enforce location-scoped access server-side. The SPFx UI hides cross-location data for UX, but the API is the security boundary.
- **Fetching all users on every page load for locations:** Sync locations on demand (startup + manual), not on every request. Cache the locations table and serve from SQL.
- **Using `DELETE` SQL for vehicle removal:** The locked decision is soft delete. Never use `DELETE FROM Vehicles`. Always set `isArchived = 1`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL connection management | Custom connection lifecycle code | `mssql` connection pool (singleton) | Handles connection retry, health checks, idle timeout. Pool reuse across function invocations. |
| SQL injection prevention | String concatenation with escaping | `request.input()` parameterized queries | Parameterized queries are the only reliable SQL injection prevention. |
| Graph API pagination | Manual `@odata.nextLink` fetch loops | `@microsoft/microsoft-graph-client` with `.top(999)` | SDK handles pagination, throttling (429 retry), and error handling. |
| Data table sorting/filtering | Custom table component | Fluent UI v8 `DetailsList` | Built-in column sorting, selection, keyboard navigation, accessibility. |
| Confirmation dialogs | Custom modal implementation | Fluent UI v8 `Dialog` | Accessible, keyboard-navigable, consistent with Fluent design system. |
| Photo upload to Blob Storage | Proxying file bytes through the API | SAS token + direct browser upload (Valet Key pattern) | API generates a short-lived upload URL. Browser uploads directly to Blob Storage. API never handles file bytes -- saves memory and bandwidth. |
| UUID generation | Custom ID generation | `IDENTITY` columns in SQL + SQL Server GUIDs where needed | Auto-incrementing integer IDs for internal use; GUIDs only if cross-system reference needed. |

**Key insight:** The combination of `mssql` connection pool + parameterized queries + zod validation provides a robust data layer without an ORM. For a serverless Azure Functions backend with a known schema, this is lighter and faster than introducing TypeORM or Prisma.

## Common Pitfalls

### Pitfall 1: Azure SQL Connection Pool Exhaustion in Azure Functions

**What goes wrong:** Functions create a new `sql.connect()` in every invocation. Connection count climbs until the database rejects connections (Azure SQL Basic tier: 30 concurrent connections max).

**Why it happens:** Azure Functions reuses the same process for warm invocations, but developers create connections at function scope instead of module scope.

**How to avoid:**
1. Create the connection pool at module scope (top of `database.ts`)
2. Check `pool.connected` before creating a new pool
3. Set `pool.max` to a reasonable value (10 for most tiers)
4. Monitor connection count in Azure SQL metrics

**Warning signs:** Intermittent "connection refused" errors. Functions work individually but fail under load. Errors about "max pool size reached."

### Pitfall 2: Graph API Throttling (429 Too Many Requests)

**What goes wrong:** Location sync fetches all users (potentially thousands) and hits Graph API rate limits. The sync function fails or returns partial data.

**Why it happens:** Graph API has per-tenant, per-app rate limits. Fetching all users with `$top=999` can trigger throttling in large organizations.

**How to avoid:**
1. Use the Graph SDK which has built-in retry-after handling for 429 responses
2. Use `$select=officeLocation` to minimize response payload
3. Implement exponential backoff for manual retries
4. Cache sync results in the Locations table -- don't re-fetch unless admin triggers sync
5. Consider incremental sync using delta queries (`/users/delta`) for large tenants

**Warning signs:** "429 Too Many Requests" errors in function logs. Sync takes more than 30 seconds. Partial location lists.

### Pitfall 3: officeLocation Data Quality Issues

**What goes wrong:** Locations synced from Entra ID have inconsistent naming. "New York", "New York Office", "NY", "new york" appear as separate locations.

**Why it happens:** The `officeLocation` field in Entra ID is free-text (128 chars). There is no validation or normalization enforced by Microsoft. Different admins enter locations differently.

**How to avoid:**
1. Trim whitespace during sync
2. Consider case-insensitive deduplication (store canonical form)
3. Display a warning to SuperAdmin if many similar-looking locations are detected
4. The Locations list view should show which Entra ID values mapped to each location
5. Accept that some data cleanup may be needed -- this is an organizational issue, not a technical one

**Warning signs:** Location dropdown has dozens of entries that look similar. Vehicle counts are scattered across near-duplicate locations.

### Pitfall 4: Fluent UI DetailsList Re-render Performance

**What goes wrong:** Fleet table with many vehicles re-renders slowly. Sorting and filtering feel sluggish.

**Why it happens:** DetailsList re-renders all rows when items array reference changes. If items are re-created on every render (e.g., inline `.filter()` in JSX), React re-renders the entire list.

**How to avoid:**
1. Memoize the filtered/sorted items array with `React.useMemo()`
2. Use `React.useCallback()` for column click handlers
3. Use `Selection` object from Fluent UI (stable reference) for row selection
4. For very large lists (500+), enable `DetailsList`'s built-in virtualization (it virtualizes by default)

**Warning signs:** Typing in the search box has visible lag. Clicking sort header takes > 200ms.

### Pitfall 5: SuperAdmin vs Admin Role Confusion in API Authorization

**What goes wrong:** Location Admins can see or modify vehicles at other locations because the API doesn't enforce location scoping.

**Why it happens:** The authorization check only verifies "is Admin or SuperAdmin" but doesn't apply the location filter for non-SuperAdmin users.

**How to avoid:**
1. Create a helper: `getLocationFilter(user)` that returns the locationId constraint for Admin users and `null` for SuperAdmin
2. Apply this filter in EVERY vehicle/category query handler
3. Test with both Admin and SuperAdmin roles
4. Never trust the client to send the correct locationId -- derive it server-side from the user's profile

**Warning signs:** Admin user can see vehicles from other locations by manipulating query parameters. Vehicle counts don't match what the admin should see.

## Code Examples

### Complete Vehicle CRUD Function

```typescript
// api/src/functions/vehicles.ts
// Source: Composite from Azure Functions v4 docs + mssql patterns

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import { getVehicles, getVehicleById, createVehicle, updateVehicle, archiveVehicle, updateVehicleStatus } from '../services/vehicleService.js';
import { VehicleInputSchema, VehicleStatusSchema } from '../models/Vehicle.js';

// GET /api/backoffice/vehicles
export async function listVehicles(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const user = getUserFromRequest(request);
  if (!user) return { status: 401, jsonBody: { error: 'Not authenticated' } };
  if (!requireRole('Admin', 'SuperAdmin')(user)) {
    return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
  }

  const filters = {
    locationId: request.query.get('locationId') ? parseInt(request.query.get('locationId')!, 10) : undefined,
    status: request.query.get('status') || undefined,
    categoryId: request.query.get('categoryId') ? parseInt(request.query.get('categoryId')!, 10) : undefined,
    search: request.query.get('search') || undefined,
  };

  // Location scoping: Admin sees only their location
  if (user.effectiveRole === 'Admin') {
    filters.locationId = await getUserLocationId(user);
  }

  const vehicles = await getVehicles(filters);
  return { jsonBody: vehicles };
}

// POST /api/backoffice/vehicles
export async function addVehicle(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const user = getUserFromRequest(request);
  if (!user) return { status: 401, jsonBody: { error: 'Not authenticated' } };
  if (!requireRole('Admin', 'SuperAdmin')(user)) {
    return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
  }

  const body = await request.json();
  const parsed = VehicleInputSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, jsonBody: { error: 'Validation failed', details: parsed.error.flatten() } };
  }

  const id = await createVehicle(parsed.data);
  return { status: 201, jsonBody: { id } };
}

app.http('listVehicles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles',
  handler: listVehicles,
});

app.http('addVehicle', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles',
  handler: addVehicle,
});
```

### Zod Validation Schema for Vehicle Input

```typescript
// api/src/models/Vehicle.ts
import { z } from 'zod';

export const VehicleInputSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  licensePlate: z.string().min(1).max(20),
  locationId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  capacity: z.number().int().min(1).max(50),
  photoUrl: z.string().url().max(500).nullable().optional(),
});

export const VehicleStatusSchema = z.object({
  status: z.enum(['Available', 'InMaintenance', 'Retired']),
});

export type VehicleInput = z.infer<typeof VehicleInputSchema>;
export type VehicleStatusInput = z.infer<typeof VehicleStatusSchema>;

export interface IVehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  locationId: number;
  locationName: string;
  categoryId: number;
  categoryName: string;
  capacity: number;
  photoUrl: string | null;
  status: 'Available' | 'InMaintenance' | 'Retired' | 'Reserved';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Location Sync Function

```typescript
// api/src/functions/locations.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import { getDistinctOfficeLocations } from '../services/graphService.js';
import { syncLocations, getLocationsWithVehicleCounts } from '../services/locationService.js';

// POST /api/backoffice/locations/sync
export async function syncLocationsTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const user = getUserFromRequest(request);
  if (!user) return { status: 401, jsonBody: { error: 'Not authenticated' } };
  if (!requireRole('SuperAdmin')(user)) {
    return { status: 403, jsonBody: { error: 'SuperAdmin role required' } };
  }

  try {
    const officeLocations = await getDistinctOfficeLocations();
    const result = await syncLocations(officeLocations);
    return {
      jsonBody: {
        message: 'Sync complete',
        added: result.added,
        deactivated: result.deactivated,
        total: result.total,
      },
    };
  } catch (error) {
    context.error('Location sync failed:', error);
    return { status: 500, jsonBody: { error: 'Location sync failed' } };
  }
}

app.http('syncLocations', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/locations/sync',
  handler: syncLocationsTrigger,
});
```

### Status Badge Component

```tsx
// spfx/src/webparts/rentaVehicle/components/FleetManagement/StatusBadge.tsx
import * as React from 'react';

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  Available: { background: '#DFF6DD', color: '#107C10' },       // green
  InMaintenance: { background: '#FFF4CE', color: '#797600' },   // yellow
  Retired: { background: '#FDE7E9', color: '#D13438' },         // red
  Reserved: { background: '#DEECF9', color: '#0078D4' },        // blue
};

const STATUS_LABELS: Record<string, string> = {
  Available: 'Available',
  InMaintenance: 'In Maintenance',
  Retired: 'Retired',
  Reserved: 'Reserved',
};

interface IStatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<IStatusBadgeProps> = ({ status }) => {
  const colors = STATUS_COLORS[status] || { background: '#F3F2F1', color: '#323130' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: colors.background,
      color: colors.color,
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQL username/password auth | Managed Identity + DefaultAzureCredential | 2024 (passwordless push) | No secrets to manage. Use `azure-active-directory-default` auth type in mssql config. |
| Graph API direct REST calls | @microsoft/microsoft-graph-client SDK | Ongoing | SDK handles pagination, throttling, and retry. Reduces boilerplate. |
| File upload through API proxy | Valet Key pattern (SAS token + direct browser upload) | Best practice since Azure Blob SAS v2 | API never handles file bytes. Reduces API memory usage and latency. |
| ORM for all database access | Direct SQL with parameterized queries for serverless | Trend in serverless | Lighter cold starts, no migration tooling needed, full SQL control. ORMs add overhead in serverless context. |

**Deprecated/outdated:**
- SQL username/password in production: Use Managed Identity instead. Password auth is still needed for local development.
- `azure-active-directory-msi-vm` and `azure-active-directory-msi-app-service` auth types in mssql: Use `azure-active-directory-default` which auto-detects the environment.
- Manual `fetch()` calls to Graph API: Use the official SDK for pagination and retry handling.

## Open Questions

1. **officeLocation claim availability in x-ms-client-principal**
   - What we know: Standard Easy Auth claims include `oid`, `name`, email, and `roles`. The `officeLocation` attribute is NOT a standard claim.
   - What's unclear: Whether configuring optional claims in the app registration (adding `office` to the access token) will make it appear in `x-ms-client-principal`, or if the API must call Graph API to get the user's officeLocation.
   - Recommendation: Start with the API calling `/me?$select=officeLocation` using the user's delegated token (On-Behalf-Of flow) or fetching from `/users/{userId}?$select=officeLocation` with application permissions. Cache per user session. If optional claims work, switch to that approach later for efficiency.

2. **Azure SQL tier for development/testing**
   - What we know: Azure SQL Database has multiple pricing tiers. Basic (5 DTUs) allows 30 concurrent connections. Standard S0 (10 DTUs) allows 60.
   - What's unclear: What tier the production deployment will use.
   - Recommendation: Use Basic or Serverless tier for development. Design for connection pooling (max 10 connections) to work across all tiers.

3. **Photo storage approach timing**
   - What we know: Azure Blob Storage with SAS tokens is the production pattern. Setting up Blob Storage requires an Azure Storage Account, CORS configuration, and SAS token generation.
   - What's unclear: Whether full Blob Storage setup should be in Phase 2 or deferred.
   - Recommendation: Implement Blob Storage in Phase 2 since photo upload is a locked requirement. The Valet Key pattern is well-documented and not complex to implement. If deferring, store a placeholder URL and implement upload in a later plan within Phase 2.

4. **Location sync on "app startup" implementation**
   - What we know: User wants sync on app startup. But Azure Functions are serverless -- there is no persistent "startup" event. SPFx loads in the user's browser.
   - What's unclear: What "app startup" means in a serverless context.
   - Recommendation: Implement as: (a) A timer-triggered Azure Function that runs once daily, (b) The SPFx app calls a `GET /api/backoffice/locations` endpoint which auto-syncs if no sync has occurred in the last 24 hours (lazy sync), (c) Manual "Sync Locations" button for SuperAdmins for on-demand sync.

## Sources

### Primary (HIGH confidence)
- [Microsoft Learn: Connect to and query using Node.js and mssql](https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart) -- mssql package patterns, connection pooling, Azure AD auth (updated Feb 2026)
- [Microsoft Learn: List users - Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0) -- officeLocation is a default returned property, pagination, $filter, $select support (updated July 2025)
- [Microsoft Learn: Tutorial - Access Microsoft Graph as the app](https://learn.microsoft.com/en-us/azure/app-service/tutorial-connect-app-access-microsoft-graph-as-app-javascript) -- DefaultAzureCredential + Graph client setup, managed identity (updated Oct 2025)
- [Microsoft Learn: Migrate to Passwordless Connections with Node.js](https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-passwordless-migration-nodejs) -- azure-active-directory-default auth type
- [Microsoft Learn: Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) -- User.Read.All application permission
- [npm: mssql](https://www.npmjs.com/package/mssql) -- Package documentation, connection pool configuration
- [GitHub: tediousjs/node-mssql](https://github.com/tediousjs/node-mssql) -- Source + detailed API docs
- [Microsoft Learn: Upload Image to Azure Blob Storage with TypeScript](https://learn.microsoft.com/en-us/azure/developer/javascript/tutorial/browser-file-upload-azure-storage-blob) -- Valet Key pattern with SAS tokens
- [GitHub: Azure-Samples/azure-typescript-upload-file-storage-blob](https://github.com/Azure-Samples/azure-typescript-upload-file-storage-blob) -- User Delegation SAS tokens with Managed Identity

### Secondary (MEDIUM confidence)
- [Enhancing Fluent UI DetailsList with Custom Sorting, Filtering, Lazy Loading and Filter Chips (Perficient, Feb 2026)](https://blogs.perficient.com/2026/02/04/enhancing-fluent-ui-detailslist-with-custom-sorting-filtering-lazy-loading-and-filter-chips/) -- DetailsList advanced patterns
- [Using Fluent UI DetailsList in SPFx (edvaldoguimaraes, Oct 2024)](https://edvaldoguimaraes.com.br/2024/10/08/using-fluent-ui-detailslist-in-sharepoint-framework-spfx/) -- SPFx-specific DetailsList implementation
- [How to Design Database for Fleet Management Systems (GeeksforGeeks)](https://www.geeksforgeeks.org/dbms/how-to-design-database-for-fleet-management-systems/) -- Schema design patterns for fleet management
- [Fleet Management Database Design Guide (Hicron)](https://hicronsoftware.com/blog/fleet-management-database-design/) -- Best practices for vehicle tables
- [Azure-Samples/azure-sql-db-node-rest-api](https://github.com/Azure-Samples/azure-sql-db-node-rest-api) -- REST API using Node.js, Azure Functions, and Azure SQL

### Tertiary (LOW confidence)
- [How to connect to Azure SQL using managed identities in Node.js (richardcarrigan.dev)](https://blog.richardcarrigan.dev/azure-sql-node-managed-id-part1) -- Managed identity with mssql package, community walkthrough
- [Graph API officeLocation filtering patterns (community Q&A)](https://learn.microsoft.com/en-us/answers/questions/857935/complex-filtering-graph-api-for-users) -- Complex filtering, $filter on officeLocation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- mssql, Graph SDK, and Fluent UI DetailsList are all well-documented, actively maintained, and verified against official Microsoft Learn sources
- Architecture patterns: HIGH -- Connection pooling, parameterized queries, Graph client credentials flow, and REST API patterns are all from official documentation
- Database schema: HIGH -- Standard normalized relational design, no exotic requirements
- Location sync: MEDIUM -- The approach is sound (Graph API + client credentials + officeLocation), but the lack of a $distinct operator means client-side deduplication is required, and officeLocation data quality depends on organizational discipline
- Admin scoping: MEDIUM -- SuperAdmin role addition is straightforward; getting the user's officeLocation for scoping has multiple approaches and needs validation
- Photo upload: MEDIUM -- The Valet Key pattern is well-documented but adds infrastructure (Azure Storage Account). Could be deferred within Phase 2 if needed.

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain, official Microsoft patterns)
