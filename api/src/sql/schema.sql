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
