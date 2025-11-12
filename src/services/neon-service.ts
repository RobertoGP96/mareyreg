import { neon } from '@neondatabase/serverless';

export class NeonService {
  private sql: ReturnType<typeof neon>;
  private apiKey: string;
  private projectId: string = 'rough-bread-57378966';

  constructor(connectionString?: string) {
    // Use @neondatabase/serverless for both browser and Node.js
    let connString = connectionString;

    if (!connString) {
      // Try different ways to access environment variables
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DATABASE_URL) {
        // Browser/Vite environment
        connString = import.meta.env.VITE_DATABASE_URL;
      } else if (typeof process !== 'undefined' && process.env) {
        // Node.js environment
        connString = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;
      } else if (typeof globalThis !== 'undefined') {
        // Fallback for global process
        const globalProcess = globalThis as { process?: { env?: { VITE_DATABASE_URL?: string; DATABASE_URL?: string } } };
        if (globalProcess.process?.env) {
          connString = globalProcess.process.env.VITE_DATABASE_URL || globalProcess.process.env.DATABASE_URL;
        }
      }
    }

    if (!connString) {
      throw new Error('No database connection string was provided. Check VITE_DATABASE_URL or DATABASE_URL environment variable.');
    }

    this.sql = neon(connString);

    // Get Neon API key
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEON_API_KEY) {
      this.apiKey = import.meta.env.VITE_NEON_API_KEY;
    } else if (typeof process !== 'undefined' && process.env) {
      this.apiKey = process.env.VITE_NEON_API_KEY || process.env.NEON_API_KEY || '';
    } else {
      this.apiKey = '';
    }

    if (!this.apiKey) {
      console.warn('No Neon API key provided. Storage usage will not be available. Set VITE_NEON_API_KEY environment variable.');
    }
  }

  async executeQuery(sqlQuery: string, params: unknown[] = []): Promise<unknown[]> {
    try {
      // Use sql.query() for dynamic SQL queries with parameters
      const result = await this.sql.query(sqlQuery, params);
      // sql.query() returns the rows directly for SELECT queries
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Neon query error:', error);
      throw error;
    }
  }

  async executeSelect(sqlQuery: string, params: unknown[] = []): Promise<unknown[][]> {
    const result = await this.executeQuery(sqlQuery, params);
    return [result];
  }

  async executeSelectAsObjects(sqlQuery: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    const result = await this.executeQuery(sqlQuery, params);
    return result as Record<string, unknown>[];
  }

  async executeInsert(sqlQuery: string, params: unknown[] = []): Promise<unknown[]> {
    const result = await this.executeQuery(sqlQuery, params);
    return result;
  }

  async executeUpdate(sqlQuery: string, params: unknown[] = []): Promise<unknown[]> {
    const result = await this.executeQuery(sqlQuery, params);
    return result;
  }

  async executeDelete(sqlQuery: string, params: unknown[] = []): Promise<unknown[]> {
    const result = await this.executeQuery(sqlQuery, params);
    return result;
  }

  async getDatabaseSize(): Promise<string> {
    const result = await this.executeSelectAsObjects("SELECT pg_size_pretty(pg_database_size(current_database())) AS size;");
    return result[0]?.size as string || 'Unknown';
  }

  async getUsedStorage(): Promise<number> {
    if (!this.apiKey) {
      throw new Error('Neon API key not configured. Set VITE_NEON_API_KEY environment variable.');
    }

    try {
      const response = await fetch(`https://console.neon.tech/api/v2/projects/${this.projectId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const storageBytes = data.project?.synthetic_storage_size || 0;
      return storageBytes / (1024 * 1024); // Convert to MB
    } catch (error) {
      console.error('Error fetching storage usage:', error);
      throw error;
    }
  }

  async getNeonStorageUsed(): Promise<number> {
    const apiKey = import.meta.env?.VITE_NEON_API_KEY;
    const projectId = import.meta.env?.VITE_STACK_PROJECT_ID || this.projectId;


    if (!projectId) {
      throw new Error('VITE_STACK_PROJECT_ID not configured');
    }

    try {
    let url: string;
    const headers: Record<string, string> = {};

    if (import.meta.env.DEV) {
      // En desarrollo, usar la API directa
      url = `https://console.neon.tech/api/v2/projects/${projectId}`;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      headers['Content-Type'] = 'application/json';
    } else {
        // En producción, usar la función serverless
        url = `/.netlify/functions/get-storage?projectId=${projectId}`;
      }


      const response = await fetch(url, { headers });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`${import.meta.env.DEV ? 'Neon API' : 'Function'} error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      let storageMB: number;
      if (import.meta.env.DEV) {
        const storageBytes = data.project?.synthetic_storage_size || 0;
        storageMB = storageBytes / (1024 * 1024);
      } else {
        storageMB = data.storageMB || 0;
      }


      return storageMB;
    } catch (error) {
      console.error('Error fetching Neon storage:', error);
      throw error;
    }
  }
}