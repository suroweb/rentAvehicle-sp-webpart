export type VehicleStatus = 'Available' | 'InMaintenance' | 'Retired' | 'Reserved';

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
  status: VehicleStatus;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IVehicleInput {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  locationId: number;
  categoryId: number;
  capacity: number;
  photoUrl?: string | null;
}

export interface IVehicleFilters {
  locationId?: number;
  status?: string;
  categoryId?: number;
  search?: string;
}
