import dotenv from 'dotenv';
import { pool } from './index';

dotenv.config();

async function migrate() {
  console.log('Applying email_otps table migration to live database...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
    `);
    console.log('✅ email_otps table created successfully in Supabase PostgreSQL!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
