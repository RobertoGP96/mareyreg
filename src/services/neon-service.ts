import { neon } from '@neondatabase/serverless';

export class NeonService {
  private sql: ReturnType<typeof neon>;

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
}