/**
 * Graph API client for location sync.
 *
 * Uses application permissions (client credentials) to fetch distinct
 * officeLocation values from all Entra ID users. Paginates through
 * all users and deduplicates server-side.
 *
 * Auth modes:
 * - Local dev: ClientSecretCredential (when AZURE_CLIENT_SECRET is set)
 * - Production: DefaultAzureCredential (Managed Identity)
 */
import { Client } from '@microsoft/microsoft-graph-client';
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from '@azure/identity';
import type { TokenCredential } from '@azure/identity';

/**
 * Creates a Graph API client authenticated with the appropriate credential.
 * For local dev (AZURE_CLIENT_SECRET set), uses ClientSecretCredential.
 * For production, uses DefaultAzureCredential (Managed Identity).
 */
async function getGraphClient(): Promise<Client> {
  let credential: TokenCredential;

  if (process.env.AZURE_CLIENT_SECRET) {
    // Local development: client secret credential
    credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID || '',
      process.env.AZURE_CLIENT_ID || '',
      process.env.AZURE_CLIENT_SECRET
    );
  } else {
    // Production: Managed Identity via DefaultAzureCredential
    credential = new DefaultAzureCredential();
  }

  const tokenResponse = await credential.getToken(
    'https://graph.microsoft.com/.default'
  );

  if (!tokenResponse) {
    throw new Error('Failed to acquire Graph API token');
  }

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.token);
    },
  });
}

/**
 * Fetches all distinct non-null officeLocation values from Entra ID users.
 * Paginates through all users via @odata.nextLink.
 * Trims whitespace and returns a sorted unique array.
 */
export async function getDistinctOfficeLocations(): Promise<string[]> {
  const client = await getGraphClient();
  const locations = new Set<string>();

  let nextLink: string | undefined =
    '/users?$select=officeLocation&$top=999';

  while (nextLink) {
    const response = await client.api(nextLink).get();

    for (const user of response.value) {
      if (user.officeLocation) {
        const trimmed = user.officeLocation.trim();
        if (trimmed.length > 0) {
          locations.add(trimmed);
        }
      }
    }

    nextLink = response['@odata.nextLink']
      ? response['@odata.nextLink'].replace(
          'https://graph.microsoft.com/v1.0',
          ''
        )
      : undefined;
  }

  return Array.from(locations).sort();
}
