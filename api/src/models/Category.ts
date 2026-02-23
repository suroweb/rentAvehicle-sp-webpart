import { z } from 'zod';

/**
 * Zod validation schema for category creation/update input.
 */
export const CategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

/** Inferred type from CategoryInputSchema */
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

/**
 * Full category record as returned from the database.
 */
export interface ICategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
