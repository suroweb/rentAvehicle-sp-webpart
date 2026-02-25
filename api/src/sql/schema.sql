-- RentAVehicle Database Schema
-- Phase 2: Vehicle Inventory and Locations

-- Locations synced from Entra ID (officeLocation attribute)
CREATE TABLE Locations (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(128) NOT NULL UNIQUE,       -- officeLocation value from Entra ID
  isActive BIT NOT NULL DEFAULT 1,           -- 0 if removed from Entra ID
  lastSyncedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Admin-defined vehicle categories
CREATE TABLE Categories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL UNIQUE,        -- e.g., 'Sedan', 'SUV', 'Van'
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

-- Phase 3: Core Booking Flow

-- Add IANA timezone column to Locations (defaults to UTC for existing rows)
ALTER TABLE Locations ADD timezone NVARCHAR(64) NOT NULL DEFAULT 'UTC';

-- Booking records for vehicle reservations
CREATE TABLE Bookings (
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
);

-- Booking indexes for common queries
CREATE INDEX IX_Bookings_VehicleId_Status ON Bookings(vehicleId, status) INCLUDE (startTime, endTime);
CREATE INDEX IX_Bookings_UserId ON Bookings(userId) INCLUDE (status, startTime, endTime);
CREATE INDEX IX_Bookings_StartTime ON Bookings(startTime) WHERE status IN ('Confirmed', 'Active');

-- Phase 4: Booking Lifecycle and Admin Oversight

-- Add lifecycle columns to Bookings table
ALTER TABLE Bookings ADD checkedOutAt DATETIME2 NULL;
ALTER TABLE Bookings ADD checkedInAt DATETIME2 NULL;
ALTER TABLE Bookings ADD cancelReason NVARCHAR(500) NULL;

-- Update status CHECK constraint to include 'Overdue'
-- Must find and drop the existing inline CHECK constraint by querying system tables
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
WHERE cc.parent_object_id = OBJECT_ID('Bookings') AND c.name = 'status';
IF @constraintName IS NOT NULL
  EXEC('ALTER TABLE Bookings DROP CONSTRAINT ' + @constraintName);

ALTER TABLE Bookings ADD CONSTRAINT CK_Bookings_Status
  CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled', 'Overdue'));

-- Phase 5: M365 Calendar Integration

-- Add resource mailbox email to Vehicles table (set by admin after Exchange provisioning)
ALTER TABLE Vehicles ADD resourceMailboxEmail NVARCHAR(255) NULL;

-- Add calendar event IDs to Bookings table (for later PATCH updates)
ALTER TABLE Bookings ADD vehicleCalendarEventId NVARCHAR(255) NULL;
ALTER TABLE Bookings ADD employeeCalendarEventId NVARCHAR(255) NULL;

-- Phase 6: Notifications
-- Tracks which scheduled reminders have been sent (prevents duplicate notifications)
ALTER TABLE Bookings ADD pickupReminderSentAt DATETIME2 NULL;
ALTER TABLE Bookings ADD returnReminderSentAt DATETIME2 NULL;
ALTER TABLE Bookings ADD overdueNotificationSentAt DATETIME2 NULL;
