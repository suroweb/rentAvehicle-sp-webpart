import { z } from 'zod';

/**
 * Zod validation schema for vehicle creation/update input.
 */
export const VehicleInputSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  licensePlate: z.string().min(1).max(20),
  locationId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  capacity: z.number().int().min(1).max(50),
  photoUrl: z.string().url().max(500).nullable().optional(),
  resourceMailboxEmail: z.string().email().max(255).nullable().optional(),
});

/**
 * Zod validation schema for vehicle status change.
 * Note: 'Reserved' is auto-set by the booking system, not manually selectable.
 */
export const VehicleStatusSchema = z.object({
  status: z.enum(['Available', 'InMaintenance', 'Retired']),
});

/**
 * Zod validation schema for setting a vehicle's resource mailbox email
 * after Exchange Online provisioning.
 */
export const VehicleMailboxSchema = z.object({
  resourceMailboxEmail: z.string().email().max(255),
});

/** Inferred type from VehicleInputSchema */
export type VehicleInput = z.infer<typeof VehicleInputSchema>;

/** Inferred type from VehicleStatusSchema */
export type VehicleStatusInput = z.infer<typeof VehicleStatusSchema>;

/**
 * Full vehicle record as returned from the database (with joined fields).
 */
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
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  resourceMailboxEmail: string | null;
}

/**
 * Filter options for vehicle listing queries.
 * All fields are optional -- omit to skip that filter.
 */
export interface IVehicleFilters {
  locationId?: number;
  status?: string;
  categoryId?: number;
  search?: string;
}
