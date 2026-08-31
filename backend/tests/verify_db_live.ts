import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function testConnection() {
  console.log('Testing connection to Supabase PostgreSQL database...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL!');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Verified Tables in Database:');
    res.rows.forEach((r) => console.log(`   - ${r.table_name}`));

    client.release();
    await pool.end();
    console.log('\n🎉 Live Supabase DB connection test passed 100%!');
  } catch (err: any) {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  }
}

testConnection();
