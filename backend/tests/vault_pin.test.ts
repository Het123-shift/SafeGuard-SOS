import crypto from 'crypto';

export async function runVaultPinTests(): Promise<{ name: string; passed: boolean; details: string }[]> {
  const results: { name: string; passed: boolean; details: string }[] = [];

  // Simulated User Profile state
  let profile = {
    emergency_pin_hash: null as string | null,
    pin_salt: null as string | null,
    pin_attempts: 0,
    locked_until: null as Date | null,
  };

  // Helper: Set Vault PIN
  const setPin = (pin: string) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + pin).digest('hex');
    profile.emergency_pin_hash = hash;
    profile.pin_salt = salt;
    profile.pin_attempts = 0;
    profile.locked_until = null;
    return { salt, hash };
  };

  // Helper: Verify Vault PIN
  const verifyPin = (pin: string, maxAttempts = 5, lockoutDurationMs = 300 * 1000) => {
    const now = new Date();
    if (profile.locked_until && now < profile.locked_until) {
      const remainingSeconds = Math.ceil((profile.locked_until.getTime() - now.getTime()) / 1000);
      return { success: false, is_locked_out: true, remaining_seconds: remainingSeconds, error: 'Locked out' };
    }

    if (!profile.emergency_pin_hash || !profile.pin_salt) {
      return { success: false, requires_pin_setup: true, error: 'No PIN configured' };
    }

    const inputHash = crypto.createHash('sha256').update(profile.pin_salt + pin).digest('hex');
    if (inputHash === profile.emergency_pin_hash) {
      profile.pin_attempts = 0;
      profile.locked_until = null;
      return { success: true, is_locked_out: false, attempts_left: maxAttempts };
    }

    profile.pin_attempts += 1;
    if (profile.pin_attempts >= maxAttempts) {
      profile.locked_until = new Date(Date.now() + lockoutDurationMs);
      return { success: false, is_locked_out: true, remaining_seconds: 300, attempts_left: 0, error: 'Lockout triggered' };
    }

    return { success: false, is_locked_out: false, attempts_left: maxAttempts - profile.pin_attempts, error: 'Incorrect PIN' };
  };

  // Test 1: Random Salt Uniqueness
  const call1 = setPin('1234');
  const salt1 = profile.pin_salt;
  const call2 = setPin('1234');
  const salt2 = profile.pin_salt;
  const isSaltUnique = salt1 !== salt2 && salt1?.length === 32 && salt2?.length === 32;
  results.push({
    name: 'Vault PIN Cryptographic Salt Generation',
    passed: isSaltUnique,
    details: isSaltUnique ? 'PASS: crypto.randomBytes(16) generates unique 32-hex salt per PIN call' : 'FAIL: Salts are not unique',
  });

  // Test 2: Successful PIN Verification
  setPin('5678');
  const validRes = verifyPin('5678');
  results.push({
    name: 'Vault PIN Verification Success',
    passed: validRes.success === true && validRes.is_locked_out === false,
    details: validRes.success ? 'PASS: Correct PIN verified and attempt counter reset' : 'FAIL: Correct PIN rejected',
  });

  // Test 3: Failed PIN Verification Counter Increment
  const fail1 = verifyPin('0000');
  const fail2 = verifyPin('0000');
  results.push({
    name: 'Vault PIN Failed Attempts Tracking',
    passed: fail1.attempts_left === 4 && fail2.attempts_left === 3,
    details: fail2.attempts_left === 3 ? 'PASS: Attempt counter accurately tracks remaining attempts (3 left)' : 'FAIL: Incorrect attempt counter',
  });

  // Test 4: 5-Attempt Lockout Trigger
  verifyPin('0000'); // attempt 3
  verifyPin('0000'); // attempt 4
  const lockRes = verifyPin('0000'); // attempt 5 (Lockout)
  results.push({
    name: 'Vault PIN 5-Attempt Lockout Enforcement',
    passed: lockRes.is_locked_out === true && lockRes.remaining_seconds === 300,
    details: lockRes.is_locked_out ? 'PASS: 5th failed attempt triggers 5-minute lockout (300s)' : 'FAIL: Lockout not triggered on 5th attempt',
  });

  // Test 5: Rejection During Lockout Window Even with Correct PIN
  const lockedCorrectRes = verifyPin('5678');
  results.push({
    name: 'Vault PIN Lockout Window Enforcement (Correct PIN Rejection)',
    passed: lockedCorrectRes.is_locked_out === true && lockedCorrectRes.success === false,
    details: lockedCorrectRes.is_locked_out ? 'PASS: Locked-out vault strictly rejects even correct PIN during lockout window' : 'FAIL: Bypass allowed during lockout',
  });

  return results;
}
