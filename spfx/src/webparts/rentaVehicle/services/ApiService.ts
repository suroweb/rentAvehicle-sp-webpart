import { AadHttpClient } from '@microsoft/sp-http';
import { IUser } from '../models/IUser';

// Placeholder: replace with the real Azure Functions app URL once deployed
const API_BASE_URL = 'https://rentavehicle-api.azurewebsites.net';

export class ApiService {
  private client: AadHttpClient;
  private baseUrl: string;

  constructor(client: AadHttpClient, baseUrl?: string) {
    this.client = client;
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  public async getMe(): Promise<IUser> {
    return this.get<IUser>('/api/me');
  }

  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.get<{ status: string; timestamp: string }>('/api/health');
  }

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
}
