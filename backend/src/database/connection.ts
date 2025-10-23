import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class Database {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = this.getConfig();
  }

  private getConfig(): DatabaseConfig {
    if (process.env.DATABASE_URL) {
      return {
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      } as DatabaseConfig;
    }

    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'myerp_db',
      user: process.env.DB_USER || 'myerp',
      password: process.env.DB_PASSWORD || 'myerp_password',
      max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool(this.config);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Set up pool error handler
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error:', err);
      });

      // Set up pool connect handler
      this.pool.on('connect', () => {
        logger.debug('New database client connected to pool');
      });

      // Set up pool remove handler
      this.pool.on('remove', () => {
        logger.debug('Database client removed from pool');
      });

    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms):`, text);
      }

      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      logger.error('Query:', text);
      logger.error('Params:', params);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }

  getPool(): Pool | null {
    return this.pool;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const DatabaseConnection = new Database();

// Export query builder helper
export const db = {
  query: <T = any>(text: string, params?: any[]) => DatabaseConnection.query<T>(text, params),
  transaction: <T>(callback: (client: PoolClient) => Promise<T>) => DatabaseConnection.transaction(callback),
  getClient: () => DatabaseConnection.getClient(),
};