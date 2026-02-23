import { AadHttpClient } from '@microsoft/sp-http';
import { IUser } from '../models/IUser';
import { IVehicle, IVehicleInput, IVehicleFilters } from '../models/IVehicle';
import { ICategory, ICategoryInput } from '../models/ICategory';
import { ILocation, ILocationSyncResult } from '../models/ILocation';
import { IBooking, IAvailableVehicle, IVehicleAvailabilitySlot, IBookingInput } from '../models/IBooking';

// Placeholder: replace with the real Azure Functions app URL once deployed
const API_BASE_URL = 'https://rentavehicle-api.azurewebsites.net';

export class ApiService {
  private client: AadHttpClient;
  private baseUrl: string;

  constructor(client: AadHttpClient, baseUrl?: string) {
    this.client = client;
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  // ── Auth ──────────────────────────────────────────────────

  public async getMe(): Promise<IUser> {
    return this.get<IUser>('/api/me');
  }

  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.get<{ status: string; timestamp: string }>('/api/health');
  }

  // ── Vehicles ──────────────────────────────────────────────

  public async getVehicles(filters?: IVehicleFilters): Promise<IVehicle[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.locationId !== undefined) {
        params.append('locationId', String(filters.locationId));
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.categoryId !== undefined) {
        params.append('categoryId', String(filters.categoryId));
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
    }
    const query = params.toString();
    const path = `/api/backoffice/vehicles${query ? `?${query}` : ''}`;
    return this.get<IVehicle[]>(path);
  }

  public async getVehicleById(id: number): Promise<IVehicle> {
    return this.get<IVehicle>(`/api/backoffice/vehicles/${id}`);
  }

  public async createVehicle(input: IVehicleInput): Promise<{ id: number }> {
    return this.post<{ id: number }>('/api/backoffice/vehicles', input);
  }

  public async updateVehicle(id: number, input: IVehicleInput): Promise<void> {
    await this.put<void>(`/api/backoffice/vehicles/${id}`, input);
  }

  public async deleteVehicle(id: number): Promise<void> {
    await this.del<void>(`/api/backoffice/vehicles/${id}`);
  }

  public async updateVehicleStatus(id: number, status: string): Promise<void> {
    await this.patch<void>(`/api/backoffice/vehicles/${id}/status`, { status });
  }

  // ── Categories ────────────────────────────────────────────

  public async getCategories(): Promise<ICategory[]> {
    return this.get<ICategory[]>('/api/backoffice/categories');
  }

  public async createCategory(input: ICategoryInput): Promise<{ id: number }> {
    return this.post<{ id: number }>('/api/backoffice/categories', input);
  }

  public async updateCategory(id: number, input: ICategoryInput): Promise<void> {
    await this.put<void>(`/api/backoffice/categories/${id}`, input);
  }

  public async deleteCategory(id: number): Promise<void> {
    await this.del<void>(`/api/backoffice/categories/${id}`);
  }

  // ── Locations ─────────────────────────────────────────────

  public async getLocations(): Promise<ILocation[]> {
    return this.get<ILocation[]>('/api/backoffice/locations');
  }

  public async syncLocations(): Promise<ILocationSyncResult> {
    return this.post<ILocationSyncResult>('/api/backoffice/locations/sync', {});
  }

  // ── Employee: Vehicle Browse & Detail ────────────────────

  public async browseAvailableVehicles(
    locationId: number,
    startTime: string,
    endTime: string,
    categoryId?: number
  ): Promise<IAvailableVehicle[]> {
    const params = new URLSearchParams();
    params.append('locationId', String(locationId));
    params.append('startTime', startTime);
    params.append('endTime', endTime);
    if (categoryId !== undefined) {
      params.append('categoryId', String(categoryId));
    }
    return this.get<IAvailableVehicle[]>(`/api/vehicles/available?${params.toString()}`);
  }

  public async getVehicleDetail(vehicleId: number): Promise<IAvailableVehicle> {
    return this.get<IAvailableVehicle>(`/api/vehicles/${vehicleId}/detail`);
  }

  public async getVehicleAvailability(
    vehicleId: number,
    days?: number
  ): Promise<IVehicleAvailabilitySlot[]> {
    const params = days !== undefined ? `?days=${days}` : '';
    return this.get<IVehicleAvailabilitySlot[]>(`/api/vehicles/${vehicleId}/availability${params}`);
  }

  // ── Employee: Bookings ──────────────────────────────────

  public async createBooking(input: IBookingInput): Promise<{ id: number }> {
    return this.postWithConflict<{ id: number }>('/api/bookings', input);
  }

  public async getMyBookings(): Promise<IBooking[]> {
    return this.get<IBooking[]>('/api/bookings/my');
  }

  public async cancelBooking(bookingId: number): Promise<void> {
    await this.del<void>(`/api/bookings/${bookingId}`);
  }

  // ── Locations (public read) ─────────────────────────────

  public async getLocationsPublic(): Promise<ILocation[]> {
    return this.get<ILocation[]>('/api/backoffice/locations');
  }

  // ── HTTP helpers ──────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.get(
      url,
      AadHttpClient.configurations.v1
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.post(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.fetch(
      url,
      AadHttpClient.configurations.v1,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.fetch(
      url,
      AadHttpClient.configurations.v1,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  /**
   * POST with specific 409 conflict detection.
   * Throws an error with message starting with 'CONFLICT:' for 409 responses
   * so the UI can distinguish booking conflicts from other errors.
   */
  private async postWithConflict<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.post(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (response.status === 409) {
      const errorText = await response.text();
      throw new Error(`CONFLICT: ${errorText || 'This slot was just booked by someone else'}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  private async del<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.client.fetch(
      url,
      AadHttpClient.configurations.v1,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }
}
