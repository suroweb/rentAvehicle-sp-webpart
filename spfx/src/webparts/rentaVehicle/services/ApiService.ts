import { AadHttpClient } from '@microsoft/sp-http';
import { IUser } from '../models/IUser';
import { IVehicle, IVehicleInput, IVehicleFilters } from '../models/IVehicle';
import { ICategory, ICategoryInput } from '../models/ICategory';
import { ILocation, ILocationSyncResult } from '../models/ILocation';
import { IBooking, IAvailableVehicle, IVehicleAvailabilitySlot, IBookingInput, ITimelineData, IBookingSuggestion, IConflictResponse } from '../models/IBooking';
import { IKpiSummary, IUtilizationData, IUtilizationVehicleData, ITrendData, IRawBookingRecord, ITeamBooking } from '../models/IReport';

// Placeholder: replace with the real Azure Functions app URL once deployed
const API_BASE_URL = 'https://rentavehicle-api.azurewebsites.net';
const LOCAL_DEV_API_URL = 'http://localhost:7071';

export class ApiService {
  private client: AadHttpClient | null;
  private baseUrl: string;
  private useLocalFetch: boolean;

  constructor(client: AadHttpClient | null, baseUrl?: string) {
    this.client = client;
    this.useLocalFetch = !client;
    this.baseUrl = baseUrl || (this.useLocalFetch ? LOCAL_DEV_API_URL : API_BASE_URL);
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

  public async getCategoriesPublic(): Promise<ICategory[]> {
    return this.get<ICategory[]>('/api/categories');
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
    days?: number,
    startDate?: string
  ): Promise<IVehicleAvailabilitySlot[]> {
    const params = new URLSearchParams();
    if (days !== undefined) params.append('days', String(days));
    if (startDate) params.append('startDate', startDate);
    const qs = params.toString();
    return this.get<IVehicleAvailabilitySlot[]>(
      '/api/vehicles/' + String(vehicleId) + '/availability' + (qs ? '?' + qs : '')
    );
  }

  // ── Employee: Bookings ──────────────────────────────────

  public async createBooking(input: IBookingInput): Promise<{ id: number } | IConflictResponse> {
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
    return this.get<ILocation[]>('/api/locations');
  }

  // ── Employee: Booking Lifecycle ────────────────────────

  public async checkOutBooking(bookingId: number): Promise<void> {
    await this.patch<void>('/api/bookings/' + String(bookingId) + '/checkout', {});
  }

  public async checkInBooking(bookingId: number): Promise<void> {
    await this.patch<void>('/api/bookings/' + String(bookingId) + '/return', {});
  }

  // ── Vehicle Timeline ──────────────────────────────────

  public async getTimeline(locationId: number, date: string): Promise<ITimelineData> {
    return this.get<ITimelineData>(
      '/api/vehicles/timeline?locationId=' + String(locationId) + '&date=' + date
    );
  }

  // ── Admin: Booking Management ─────────────────────────

  public async getAllBookings(filters: {
    locationId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    employeeSearch?: string;
  }): Promise<IBooking[]> {
    const params = new URLSearchParams();
    if (filters.locationId !== undefined) {
      params.append('locationId', String(filters.locationId));
    }
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo);
    }
    if (filters.employeeSearch) {
      params.append('employeeSearch', filters.employeeSearch);
    }
    const query = params.toString();
    const path = '/api/backoffice/bookings' + (query ? '?' + query : '');
    return this.get<IBooking[]>(path);
  }

  public async adminCancelBooking(bookingId: number, cancelReason: string): Promise<void> {
    await this.delWithBody<void>(
      '/api/backoffice/bookings/' + String(bookingId),
      { cancelReason: cancelReason }
    );
  }

  // ── Reports ─────────────────────────────────────────────

  public async getKpi(dateFrom: string, dateTo: string): Promise<IKpiSummary> {
    const params = new URLSearchParams();
    params.append('dateFrom', dateFrom);
    params.append('dateTo', dateTo);
    return this.get<IKpiSummary>('/api/backoffice/reports/kpi?' + params.toString());
  }

  public async getUtilizationReport(
    dateFrom: string,
    dateTo: string,
    locationId?: number
  ): Promise<IUtilizationData[] | IUtilizationVehicleData[]> {
    const params = new URLSearchParams();
    params.append('dateFrom', dateFrom);
    params.append('dateTo', dateTo);
    if (locationId !== undefined) {
      params.append('locationId', String(locationId));
    }
    return this.get<IUtilizationData[] | IUtilizationVehicleData[]>(
      '/api/backoffice/reports/utilization?' + params.toString()
    );
  }

  public async getTrends(
    dateFrom: string,
    dateTo: string,
    granularity: 'daily' | 'weekly',
    locationId?: number,
    categoryId?: number
  ): Promise<ITrendData[]> {
    const params = new URLSearchParams();
    params.append('dateFrom', dateFrom);
    params.append('dateTo', dateTo);
    params.append('granularity', granularity);
    if (locationId !== undefined) {
      params.append('locationId', String(locationId));
    }
    if (categoryId !== undefined) {
      params.append('categoryId', String(categoryId));
    }
    return this.get<ITrendData[]>('/api/backoffice/reports/trends?' + params.toString());
  }

  public async getRawExportData(dateFrom: string, dateTo: string): Promise<IRawBookingRecord[]> {
    const params = new URLSearchParams();
    params.append('dateFrom', dateFrom);
    params.append('dateTo', dateTo);
    params.append('type', 'raw');
    return this.get<IRawBookingRecord[]>('/api/backoffice/reports/export?' + params.toString());
  }

  // ── Team Bookings ─────────────────────────────────────────

  public async getTeamBookings(): Promise<ITeamBooking[]> {
    return this.get<ITeamBooking[]>('/api/backoffice/team-bookings');
  }

  // ── HTTP helpers ──────────────────────────────────────────

  /**
   * Unified fetch that uses AadHttpClient when available, plain fetch for local dev.
   */
  private async _fetch(url: string, method: string, body?: unknown): Promise<Response> {
    if (this.useLocalFetch || !this.client) {
      return this._localFetch(url, method, body);
    }

    // Try AadHttpClient first; if token acquisition fails, fall back to local fetch
    try {
      let response: Response;
      if (method === 'GET') {
        response = await this.client.get(url, AadHttpClient.configurations.v1) as unknown as Response;
      } else if (method === 'POST') {
        response = await this.client.post(url, AadHttpClient.configurations.v1, {
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        }) as unknown as Response;
      } else {
        response = await this.client.fetch(url, AadHttpClient.configurations.v1, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        }) as unknown as Response;
      }
      return response;
    } catch {
      // AadHttpClient failed (e.g. workbench can't get tokens) — fall back to local API
      this.useLocalFetch = true;
      this.baseUrl = LOCAL_DEV_API_URL;
      const localUrl = url.replace(/https?:\/\/[^/]+/, LOCAL_DEV_API_URL);
      return this._localFetch(localUrl, method, body);
    }
  }

  private _localFetch(url: string, method: string, body?: unknown): Promise<Response> {
    const init: RequestInit = {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    };
    return fetch(url, init);
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, 'GET');

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
    const response = await this._fetch(url, 'POST', body);

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
    const response = await this._fetch(url, 'PUT', body);

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
    const response = await this._fetch(url, 'PATCH', body);

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
   * Returns a structured IConflictResponse on 409 (with suggestions from the API)
   * so the UI can distinguish booking conflicts from other errors and show alternatives.
   */
  private async postWithConflict<T>(path: string, body: unknown): Promise<T | IConflictResponse> {
    const url = this.baseUrl + path;
    const response = await this._fetch(url, 'POST', body);

    if (response.status === 409) {
      const responseText = await response.text();
      let suggestions: IBookingSuggestion[] = [];
      let conflictMessage = 'This slot was just booked by someone else';
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && parsed.error) {
          conflictMessage = parsed.error;
        }
        if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
          suggestions = parsed.suggestions;
        }
      } catch (e) {
        // JSON parse failed -- use raw text as conflict message
        if (e && responseText) {
          conflictMessage = responseText;
        }
      }
      return {
        conflict: true,
        message: conflictMessage,
        suggestions: suggestions,
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        'API request failed: ' + String(response.status) + ' ' + response.statusText + ' - ' + errorText
      );
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  /**
   * DELETE with JSON body (for admin cancel with reason).
   */
  private async delWithBody<T>(path: string, body: unknown): Promise<T> {
    const url = this.baseUrl + path;
    const response = await this._fetch(url, 'DELETE', body);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        'API request failed: ' + String(response.status) + ' ' + response.statusText + ' - ' + errorText
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
    const response = await this._fetch(url, 'DELETE');

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
