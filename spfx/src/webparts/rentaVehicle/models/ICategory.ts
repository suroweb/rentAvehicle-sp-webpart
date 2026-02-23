export interface ICategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICategoryInput {
  name: string;
  description?: string;
}
