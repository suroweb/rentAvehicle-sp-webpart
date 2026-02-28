// Temporary script to create database and run schema
const sql = require('mssql');

async function setup() {
  const masterConfig = {
    server: 'localhost',
    port: 1433,
    user: 'sa',
    password: 'YourStrong!Pass123',
    database: 'master',
    options: { encrypt: false, trustServerCertificate: true },
  };

  console.log('Connecting to master...');
  let pool = await sql.connect(masterConfig);

  console.log('Creating RentAVehicle database...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'RentAVehicle')
      CREATE DATABASE RentAVehicle;
  `);
  await pool.close();

  // Connect to RentAVehicle
  const appConfig = { ...masterConfig, database: 'RentAVehicle' };
  console.log('Connecting to RentAVehicle...');
  pool = await sql.connect(appConfig);

  // Run each statement explicitly to handle multi-line CREATE TABLEs
  const statements = [
    // Core tables
    `CREATE TABLE Locations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(128) NOT NULL UNIQUE,
      isActive BIT NOT NULL DEFAULT 1,
      lastSyncedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )`,
    `CREATE TABLE Categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(100) NOT NULL UNIQUE,
      description NVARCHAR(500) NULL,
      isActive BIT NOT NULL DEFAULT 1,
      createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )`,
    `CREATE TABLE Vehicles (
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
    )`,
    `CREATE INDEX IX_Vehicles_LocationId ON Vehicles(locationId)`,
    `CREATE INDEX IX_Vehicles_CategoryId ON Vehicles(categoryId)`,
    `CREATE INDEX IX_Vehicles_Status ON Vehicles(status) WHERE isArchived = 0`,
    `CREATE INDEX IX_Vehicles_IsArchived ON Vehicles(isArchived)`,

    // Timezone + bookings
    `ALTER TABLE Locations ADD timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC'`,
    `CREATE TABLE Bookings (
      id INT IDENTITY(1,1) PRIMARY KEY,
      vehicleId INT NOT NULL REFERENCES Vehicles(id),
      userId NVARCHAR(255) NOT NULL,
      userEmail NVARCHAR(255) NOT NULL,
      userDisplayName NVARCHAR(255) NULL,
      startTime DATETIME2 NOT NULL,
      endTime DATETIME2 NOT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'Confirmed'
        CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled')),
      cancelledAt DATETIME2 NULL,
      cancelledBy NVARCHAR(255) NULL,
      createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT CK_Bookings_TimeOrder CHECK (endTime > startTime)
    )`,
    `CREATE INDEX IX_Bookings_VehicleId_Status ON Bookings(vehicleId, status) INCLUDE (startTime, endTime)`,
    `CREATE INDEX IX_Bookings_UserId ON Bookings(userId) INCLUDE (status, startTime, endTime)`,
    `CREATE INDEX IX_Bookings_StartTime ON Bookings(startTime) WHERE status IN ('Confirmed', 'Active')`,

    // Booking lifecycle
    `ALTER TABLE Bookings ADD checkedOutAt DATETIME2 NULL`,
    `ALTER TABLE Bookings ADD checkedInAt DATETIME2 NULL`,
    `ALTER TABLE Bookings ADD cancelReason NVARCHAR(500) NULL`,

    // Calendar integration
    `ALTER TABLE Vehicles ADD resourceMailboxEmail NVARCHAR(255) NULL`,
    `ALTER TABLE Bookings ADD vehicleCalendarEventId NVARCHAR(255) NULL`,
    `ALTER TABLE Bookings ADD employeeCalendarEventId NVARCHAR(255) NULL`,

    // Notification tracking
    `ALTER TABLE Bookings ADD pickupReminderSentAt DATETIME2 NULL`,
    `ALTER TABLE Bookings ADD returnReminderSentAt DATETIME2 NULL`,
    `ALTER TABLE Bookings ADD overdueNotificationSentAt DATETIME2 NULL`,
  ];

  for (const stmt of statements) {
    const label = stmt.substring(0, 70).replace(/\n/g, ' ').trim();
    try {
      console.log('  Running:', label + '...');
      await pool.request().query(stmt);
    } catch (err) {
      if (err.message.includes('already') || err.message.includes('There is already') || err.message.includes('Column names in each table must be unique')) {
        console.log('    (already exists, skipping)');
      } else {
        console.error('    ERROR:', err.message);
      }
    }
  }

  // Seed test data
  console.log('\nSeeding test data...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Locations WHERE name = 'Bucharest')
      INSERT INTO Locations (name, timezone) VALUES ('Bucharest', 'Europe/Bucharest')
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Locations WHERE name = 'Cluj')
      INSERT INTO Locations (name, timezone) VALUES ('Cluj', 'Europe/Bucharest')
  `);
  await pool.request().query(`
    UPDATE Locations SET timezone = 'Europe/Bucharest' WHERE timezone = 'UTC'
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Categories WHERE name = 'Sedan')
      INSERT INTO Categories (name, description) VALUES ('Sedan', 'Standard sedan')
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Categories WHERE name = 'SUV')
      INSERT INTO Categories (name, description) VALUES ('SUV', 'Sport utility vehicle')
  `);

  const locResult = await pool.request().query(`SELECT id FROM Locations WHERE name = 'Bucharest'`);
  const catSedanResult = await pool.request().query(`SELECT id FROM Categories WHERE name = 'Sedan'`);
  const catSuvResult = await pool.request().query(`SELECT id FROM Categories WHERE name = 'SUV'`);
  const locId = locResult.recordset[0].id;
  const sedanId = catSedanResult.recordset[0].id;
  const suvId = catSuvResult.recordset[0].id;

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE licensePlate = 'B-123-ABC')
      INSERT INTO Vehicles (make, model, year, licensePlate, locationId, categoryId, capacity)
      VALUES ('Toyota', 'Corolla', 2024, 'B-123-ABC', ${locId}, ${sedanId}, 5)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE licensePlate = 'B-456-DEF')
      INSERT INTO Vehicles (make, model, year, licensePlate, locationId, categoryId, capacity)
      VALUES ('Volkswagen', 'Golf', 2023, 'B-456-DEF', ${locId}, ${sedanId}, 5)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE licensePlate = 'B-789-GHI')
      INSERT INTO Vehicles (make, model, year, licensePlate, locationId, categoryId, capacity)
      VALUES ('Dacia', 'Duster', 2024, 'B-789-GHI', ${locId}, ${suvId}, 7)
  `);

  console.log('\nDone! Database ready with test data.');
  console.log('  Locations: Bucharest, Cluj (Europe/Bucharest)');
  console.log('  Categories: Sedan, SUV');
  console.log('  Vehicles: Toyota Corolla, VW Golf, Dacia Duster (all in Bucharest)');

  await pool.close();
  process.exit(0);
}

setup().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
