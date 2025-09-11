import { getBackendUrl } from '../utils/envConfig';

export interface DatabaseHealthStatus {
  success: boolean;
  database?: {
    status: string;
    responseTime?: string;
    server: string;
    database: string;
    connected: boolean;
    timestamp: string;
    connection?: {
      server: string;
      database: string;
      user: string;
      port: number;
      encrypt: boolean;
      connected: boolean;
    };
  };
  error?: string;
}

export interface DatabaseQueryResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  sqlError?: string;
}

export interface DatabaseTable {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
}

export interface LogEntry {
  id: number;
  message: string;
  level: string;
  source: string;
  created_at: string;
}

class DatabaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBackendUrl();
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<DatabaseHealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/test-connection`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database-health`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute test query
   */
  async executeTestQuery(): Promise<DatabaseQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/test-query`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Test query failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get database tables
   */
  async getTables(): Promise<DatabaseQueryResult & { tables?: DatabaseTable[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/tables`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve tables',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create logs table
   */
  async createLogsTable(): Promise<DatabaseQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/create-logs-table`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create logs table',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a log entry
   */
  async createLogEntry(message: string, level: string = 'INFO', source: string = 'Frontend'): Promise<DatabaseQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/log-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          level,
          source
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create log entry',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get recent log entries
   */
  async getLogs(limit: number = 10): Promise<DatabaseQueryResult & { data?: LogEntry[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/logs?limit=${limit}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test all database operations
   */
  async runFullTest(): Promise<{
    connection: DatabaseHealthStatus;
    query: DatabaseQueryResult;
    tables: DatabaseQueryResult;
    createTable: DatabaseQueryResult;
    createLog: DatabaseQueryResult;
    getLogs: DatabaseQueryResult;
  }> {
    const results = {
      connection: await this.testConnection(),
      query: await this.executeTestQuery(),
      tables: await this.getTables(),
      createTable: await this.createLogsTable(),
      createLog: { success: false, message: 'Not executed' } as DatabaseQueryResult,
      getLogs: { success: false, message: 'Not executed' } as DatabaseQueryResult
    };

    // Only try to create log and get logs if table creation was successful
    if (results.createTable.success) {
      results.createLog = await this.createLogEntry('Database test log entry', 'INFO', 'DatabaseService');
      results.getLogs = await this.getLogs(5);
    }

    return results;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
