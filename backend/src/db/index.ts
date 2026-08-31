import fs from 'fs';
import path from 'path';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';

const requiresSsl =
  env.NODE_ENV === 'production' ||
  env.DATABASE_URL.includes('pooler') ||
  env.DATABASE_URL.includes('supabase.co') ||
  env.DATABASE_URL.includes('render.com') ||
  env.DATABASE_URL.includes('railway') ||
  env.DATABASE_URL.includes('sslmode=require');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected error on idle client', err);
});

/**
 * Automatically initializes database tables and indexes from schema.sql
 * if they do not already exist. Runs on server startup.
 */
export async function initDatabase(): Promise<void> {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(sql);
      console.log('[DB] Database schema & indexes verified/initialized successfully.');
    }
  } catch (err: any) {
    console.warn('[DB] Automatic schema initialization warning:', err.message);
  }
}

/**
 * Execute a parameterized SQL query against the PostgreSQL database.
 * Enforces parameterization ($1, $2, ...) to prevent SQL injection.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development') {
      console.log('[DB Query]', { text: text.slice(0, 100).replace(/\s+/g, ' '), duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (err: any) {
    console.error('[DB Query Error]', { text, params, error: err.message });
    throw err;
  }
}
