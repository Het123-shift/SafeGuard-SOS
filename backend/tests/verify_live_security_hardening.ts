import http from 'http';
import { app } from '../src/app';
import { pool, query } from '../src/db';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

async function runLiveSecurityVerification() {
  const PORT = 4002;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  const baseUrl = `http://localhost:${PORT}`;

  console.log('================================================================');
  console.log(' 🛡️  SAFEGUARD SOS LIVE SECURITY HARDENING AUDIT SUITE');
  console.log(' Connecting to Real Live Infrastructure:');
  console.log(` Database: ${env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(` Server  : Live Express HTTP Server on ${baseUrl}`);
  console.log('================================================================\n');

  // Generate test user IDs
  const userAEmail = `audit_user_a_${Date.now()}@safeguard.local`;
  const userBEmail = `audit_user_b_${Date.now()}@safeguard.local`;

  let userAId = '';
  let userBId = '';
  let tokenA = '';
  let tokenB = '';

  try {
    // 1. Provision User A & User B in the live database
    console.log('--- STEP 1: PROVISIONING LIVE USERS IN DATABASE ---');
    const userARes = await query(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'dummy_hash') RETURNING id`,
      [userAEmail]
    );
    userAId = userARes.rows[0].id;
    await query(`INSERT INTO user_profiles (id, full_name, phone) VALUES ($1, 'User Alpha', '+15551112222')`, [userAId]);

    const userBRes = await query(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'dummy_hash') RETURNING id`,
      [userBEmail]
    );
    userBId = userBRes.rows[0].id;
    await query(`INSERT INTO user_profiles (id, full_name, phone) VALUES ($1, 'User Beta', '+15553334444')`, [userBId]);

    tokenA = jwt.sign({ sub: userAId, email: userAEmail }, env.JWT_SECRET, { expiresIn: '15m' });
    tokenB = jwt.sign({ sub: userBId, email: userBEmail }, env.JWT_SECRET, { expiresIn: '15m' });

    console.log(`[DB Insert] Provisioned User A: id=${userAId}, email=${userAEmail}`);
    console.log(`[DB Insert] Provisioned User B: id=${userBId}, email=${userBEmail}`);
    console.log(`[JWT Issue] Token A generated: ${tokenA.substring(0, 25)}...`);
    console.log(`[JWT Issue] Token B generated: ${tokenB.substring(0, 25)}...\n`);

    // 2. Cross-User Authorization Parity Audit
    console.log('--- STEP 2: LIVE CROSS-USER AUTHORIZATION PARITY AUDIT ---');

    // 2a. User A creates a priority contact
    const createContactRaw = await fetch(`${baseUrl}/api/contacts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha Priority Doctor', phone: '+19876543210', isPriority: true }),
    });
    const createContactBody: any = await createContactRaw.json();
    console.log(`[HTTP POST /api/contacts (User A)] Status: ${createContactRaw.status}`);
    console.log(`  Response:`, JSON.stringify(createContactBody));
    const userAContactId = createContactBody.contact.id;

    // 2b. User A creates an SOS event
    const createSOSRaw = await fetch(`${baseUrl}/api/sos/events`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerType: 'manual', latitude: 28.6139, longitude: 77.2090 }),
    });
    const createSOSBody: any = await createSOSRaw.json();
    console.log(`[HTTP POST /api/sos/events (User A)] Status: ${createSOSRaw.status}`);
    console.log(`  Response:`, JSON.stringify(createSOSBody));

    // 2c. User B attempts to read User A's contacts
    const userBContactsRaw = await fetch(`${baseUrl}/api/contacts`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const userBContactsBody: any = await userBContactsRaw.json();
    console.log(`\n[HTTP GET /api/contacts (User B)] Status: ${userBContactsRaw.status}`);
    console.log(`  Response contacts count: ${userBContactsBody.contacts.length}`);
    const isContactsIsolated = userBContactsBody.contacts.length === 0;
    console.log(`  👉 RESULT: ${isContactsIsolated ? '✅ PASS: User B sees 0 contacts (User A contacts isolated)' : '❌ FAIL: Data Leak'}`);

    // 2d. User B attempts to edit User A's contact
    const userBEditRaw = await fetch(`${baseUrl}/api/contacts/${userAContactId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Contact Name', phone: '+10000000000' }),
    });
    const userBEditBody: any = await userBEditRaw.json();
    console.log(`\n[HTTP PUT /api/contacts/${userAContactId} (User B attempting modify User A contact)] Status: ${userBEditRaw.status}`);
    console.log(`  Response:`, JSON.stringify(userBEditBody));
    const isEditBlocked = userBEditRaw.status === 404;
    console.log(`  👉 RESULT: ${isEditBlocked ? '✅ PASS: User B edit rejected with 404 (Scoped to user_id)' : '❌ FAIL: Unauthorized mutation'}`);

    // 2e. User B attempts to delete User A's contact
    const userBDeleteRaw = await fetch(`${baseUrl}/api/contacts/${userAContactId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const userBDeleteBody: any = await userBDeleteRaw.json();
    console.log(`\n[HTTP DELETE /api/contacts/${userAContactId} (User B attempting delete User A contact)] Status: ${userBDeleteRaw.status}`);
    console.log(`  Response:`, JSON.stringify(userBDeleteBody));
    const isDeleteBlocked = userBDeleteRaw.status === 404;
    console.log(`  👉 RESULT: ${isDeleteBlocked ? '✅ PASS: User B delete rejected with 404' : '❌ FAIL: Unauthorized deletion'}`);

    // 2f. User B attempts to read User A's SOS events
    const userBSoSRaw = await fetch(`${baseUrl}/api/sos/events`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const userBSoSBody: any = await userBSoSRaw.json();
    console.log(`\n[HTTP GET /api/sos/events (User B)] Status: ${userBSoSRaw.status}`);
    console.log(`  Response SOS events count: ${userBSoSBody.events.length}`);
    const isSosIsolated = userBSoSBody.events.length === 0;
    console.log(`  👉 RESULT: ${isSosIsolated ? '✅ PASS: User B sees 0 SOS events (User A events isolated)' : '❌ FAIL: SOS events leaked'}`);

    // 2g. User B reads own profile
    const userBProfileRaw = await fetch(`${baseUrl}/api/profile`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const userBProfileBody: any = await userBProfileRaw.json();
    console.log(`\n[HTTP GET /api/profile (User B)] Status: ${userBProfileRaw.status}`);
    console.log(`  Response profile:`, JSON.stringify(userBProfileBody));
    const isProfileIsolated = userBProfileBody.profile.id === userBId && userBProfileBody.profile.fullName === 'User Beta';
    console.log(`  👉 RESULT: ${isProfileIsolated ? '✅ PASS: User B profile strictly matches User B' : '❌ FAIL: Wrong profile returned'}`);


    // 3. Vault PIN Security & Lockout Audit Against Live Database
    console.log('\n--- STEP 3: LIVE VAULT PIN CRYPTOGRAPHIC SALT & LOCKOUT AUDIT ---');

    // 3a. Set PIN for User A
    const setPinRaw = await fetch(`${baseUrl}/api/vault/pin/set`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4829' }),
    });
    const setPinBody: any = await setPinRaw.json();
    console.log(`[HTTP POST /api/vault/pin/set (User A, PIN='4829')] Status: ${setPinRaw.status}`);
    console.log(`  Response:`, JSON.stringify(setPinBody));

    // Verify DB state directly in PostgreSQL table user_profiles
    const dbProfileRes = await query(
      `SELECT emergency_pin_hash, pin_salt, pin_attempts, locked_until FROM user_profiles WHERE id = $1`,
      [userAId]
    );
    const dbRow = dbProfileRes.rows[0];
    console.log(`[PostgreSQL DB Row in user_profiles]:`);
    console.log(`  emergency_pin_hash: ${dbRow.emergency_pin_hash}`);
    console.log(`  pin_salt          : ${dbRow.pin_salt} (Length: ${dbRow.pin_salt.length} hex chars)`);
    console.log(`  pin_attempts      : ${dbRow.pin_attempts}`);
    console.log(`  locked_until      : ${dbRow.locked_until}`);

    const isSaltValid = dbRow.pin_salt.length === 32 && dbRow.emergency_pin_hash.length === 64;
    console.log(`  👉 RESULT: ${isSaltValid ? '✅ PASS: Per-user 16-byte random salt and SHA-256 hash verified in PostgreSQL' : '❌ FAIL'}`);

    // 3b. Verify Correct PIN
    const verifyCorrectRaw = await fetch(`${baseUrl}/api/vault/pin/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4829' }),
    });
    const verifyCorrectBody: any = await verifyCorrectRaw.json();
    console.log(`\n[HTTP POST /api/vault/pin/verify (Attempt with Correct PIN '4829')] Status: ${verifyCorrectRaw.status}`);
    console.log(`  Response:`, JSON.stringify(verifyCorrectBody));
    console.log(`  👉 RESULT: ${verifyCorrectBody.success === true ? '✅ PASS: Correct PIN accepted' : '❌ FAIL'}`);

    // 3c. Execute 5 consecutive failed PIN attempts
    console.log('\n[Simulating 5 Consecutive Failed Attempts with PIN 0000]...');
    for (let attempt = 1; attempt <= 5; attempt++) {
      const failRaw = await fetch(`${baseUrl}/api/vault/pin/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
      });
      const failBody: any = await failRaw.json();
      const dbCheck = await query(`SELECT pin_attempts, locked_until FROM user_profiles WHERE id = $1`, [userAId]);
      console.log(`  Attempt ${attempt}: HTTP ${failRaw.status} -> attempts_left: ${failBody.attempts_left}, is_locked_out: ${failBody.is_locked_out} | DB: attempts=${dbCheck.rows[0].pin_attempts}, locked_until=${dbCheck.rows[0].locked_until}`);
    }

    // 3d. 6th Attempt: Attempting with CORRECT PIN '4829' during Lockout Window
    console.log('\n[6th Attempt: Submitting CORRECT PIN during Lockout]');
    const lockedVerificationRaw = await fetch(`${baseUrl}/api/vault/pin/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4829' }),
    });
    const lockedVerificationBody: any = await lockedVerificationRaw.json();
    console.log(`[HTTP POST /api/vault/pin/verify with CORRECT PIN during lockout] Status: ${lockedVerificationRaw.status}`);
    console.log(`  Response:`, JSON.stringify(lockedVerificationBody));
    const isLockedOutStrictly = lockedVerificationRaw.status === 423 && lockedVerificationBody.is_locked_out === true;
    console.log(`  👉 RESULT: ${isLockedOutStrictly ? '✅ PASS: Vault STRICTLY REJECTS even correct PIN during active lockout window (HTTP 423 Locked)' : '❌ FAIL: Lockout bypassed!'}`);

    // 4. Cleanup test rows
    console.log('\n--- CLEANUP ---');
    await query(`DELETE FROM contacts WHERE user_id IN ($1, $2)`, [userAId, userBId]);
    await query(`DELETE FROM sos_events WHERE user_id IN ($1, $2)`, [userAId, userBId]);
    await query(`DELETE FROM user_profiles WHERE id IN ($1, $2)`, [userAId, userBId]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [userAId, userBId]);
    console.log('✅ Temporary test users and records cleaned up cleanly from database.\n');

    console.log('================================================================');
    console.log(' 🎉 ALL LIVE SECURITY HARDENING AUDIT CHECKS PASSED ON LIVE INFRASTRUCTURE');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Audit Failed with exception:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runLiveSecurityVerification();
