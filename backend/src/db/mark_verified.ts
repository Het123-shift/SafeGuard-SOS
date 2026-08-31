import dotenv from 'dotenv';
import { pool } from './index';

dotenv.config();

async function markVerified() {
  const res = await pool.query(`
    UPDATE user_profiles 
    SET email_verified = true 
    WHERE id IN (SELECT id FROM users WHERE email = 'patel131106@gmail.com')
    RETURNING id, full_name, email_verified;
  `);
  console.log('✅ Marked email verified in database:', res.rows);
  await pool.end();
}

markVerified();
