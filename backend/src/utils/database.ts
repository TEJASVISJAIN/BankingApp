import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger';

// Create connection pool
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test database connection
pool.on('connect', () => {
  logger.info('📊 Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('❌ Database connection error:', err);
});

// Database query helper with error handling
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      logger.warn(`Slow query detected: ${duration}ms`, { query: text.substring(0, 100) });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', { query: text, error: error.message });
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
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
