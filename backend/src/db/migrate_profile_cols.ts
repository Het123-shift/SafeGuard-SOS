import dotenv from 'dotenv';
import { pool } from './index';

dotenv.config();

async function migrate() {
  console.log('Adding email_verified and missing columns to user_profiles table...');
  try {
    await pool.query(`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS blood_type TEXT,
      ADD COLUMN IF NOT EXISTS emergency_notes TEXT;
    `);
    console.log('✅ Columns added successfully to user_profiles table in Supabase PostgreSQL!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
