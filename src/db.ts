import 'dotenv/config';
import { Pool } from 'pg';

// Same Pool approach as T14. Read local connection settings from .env (T15).
export const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'engineering_inventory',
  connectionTimeoutMillis: 5000,
});
pool.on('error', (error) => console.error('Idle database connection error:', error.message));
