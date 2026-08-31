import dotenv from 'dotenv';
import { pool } from '../src/db';
import crypto from 'crypto';

dotenv.config();

const BASE_URL = 'http://localhost:4000';
const TEST_EMAIL = 'otp_test_' + Date.now() + '@safeguard-sos.app';

async function runOtpTests() {
  console.log('================================================================');
  console.log(' SafeGuard SOS Self-Hosted Email OTP Verification Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      if (detail) console.log(`     └─ ${detail}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (detail) console.error(`     └─ ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Send OTP Test
    console.log('--- 1. EMAIL OTP GENERATION & DISPATCH ---');
    const sendRes = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const sendData: any = await sendRes.json();
    assert(sendRes.ok && sendData.success === true, 'OTP Send Endpoint Returns 200 OK', `Message: ${sendData.message}`);

    // Verify row in database
    const dbOtp = await pool.query('SELECT * FROM email_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1', [TEST_EMAIL]);
    assert(dbOtp.rows.length > 0 && dbOtp.rows[0].otp_hash.length === 64, 'OTP Record Persisted in Supabase PostgreSQL with SHA-256 Hash', `Hash: ${dbOtp.rows[0]?.otp_hash?.substring(0, 16)}...`);

    // 2. Cooldown Rate Limit Test
    console.log('\n--- 2. RAPID-REPEAT 30s COOLDOWN ENFORCEMENT ---');
    const spamRes = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const spamData: any = await spamRes.json();
    assert(spamRes.status === 429 && spamData.success === false, 'Rapid-repeat OTP Request (<30s) Rejected with 429 Too Many Requests', `Error: ${spamData.error}`);

    // 3. Incorrect OTP Code Rejection & Attempt Tracking
    console.log('\n--- 3. INCORRECT OTP CODE REJECTION & ATTEMPT LOCKOUT ---');
    const wrongRes = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, otp: '000000' }),
    });
    const wrongData: any = await wrongRes.json();
    assert(wrongRes.status === 400 && wrongData.success === false, 'Incorrect OTP Code Rejected with 400 Bad Request', `Response: ${wrongData.error}`);

    // Verify attempts counter incremented in DB
    const dbAttempts = await pool.query('SELECT attempts FROM email_otps WHERE email = $1', [TEST_EMAIL]);
    assert(dbAttempts.rows[0].attempts === 1, 'Database Attempt Counter Incremented to 1', `Attempts recorded: ${dbAttempts.rows[0].attempts}`);

    // 4. Valid OTP Verification & Auto-Provisioning
    console.log('\n--- 4. VALID OTP VERIFICATION & JWT ISSUANCE ---');
    const knownOtp = '789123';
    const knownHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
    await pool.query(
      'UPDATE email_otps SET otp_hash = $1, attempts = 0 WHERE email = $2',
      [knownHash, TEST_EMAIL]
    );

    const validRes = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, otp: knownOtp }),
    });
    const validData: any = await validRes.json();
    assert(
      validRes.ok && validData.success === true && !!validData.tokens?.accessToken,
      'Valid OTP Successfully Authenticated with JWT Tokens',
      `User ID: ${validData.user?.id}, Email Verified: ${validData.user?.emailVerified}`
    );

    // Verify used OTP is deleted from database
    const dbClean = await pool.query('SELECT * FROM email_otps WHERE email = $1', [TEST_EMAIL]);
    assert(dbClean.rows.length === 0, 'Used OTP Record Automatically Cleaned Up from Database', 'Zero lingering OTP tokens');

    // Verify user profile exists in database with email_verified = true
    const dbProfile = await pool.query('SELECT email_verified FROM user_profiles WHERE id = $1', [validData.user?.id]);
    assert(dbProfile.rows[0]?.email_verified === true, 'User Profile Flag email_verified Persisted as TRUE in Supabase PostgreSQL', 'Profile email_verified: true');

    // Clean up test user
    await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
  } catch (err: any) {
    console.error('Test error:', err);
    failed++;
  } finally {
    await pool.end();
    console.log('\n================================================================');
    console.log(` Test Summary: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(` Pass Rate   : ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('================================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runOtpTests();
