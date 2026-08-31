import dotenv from 'dotenv';
import { pool } from '../src/db';

dotenv.config();

async function check() {
  const users = await pool.query('SELECT id, email, created_at FROM users');
  console.log('✅ Users registered in Supabase PostgreSQL:');
  console.table(users.rows);

  const profiles = await pool.query('SELECT id, full_name, phone, city FROM user_profiles');
  console.log('✅ User Profiles in Supabase PostgreSQL:');
  console.table(profiles.rows);

  await pool.end();
}

check();
