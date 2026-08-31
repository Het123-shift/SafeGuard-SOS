import { runAuthParityTests } from './auth_parity.test';
import { runVaultPinTests } from './vault_pin.test';
import { runTrackingSecurityTests } from './tracking_security.test';
import { runEvidenceR2Tests } from './evidence_r2.test';
import { runSecurityHardeningTests } from './security_hardening.test';

async function main() {
  console.log(`\n================================================================`);
  console.log(` SafeGuard SOS Backend Security-Hardening Test Suite`);
  console.log(`================================================================\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const suites = [
    { title: '1. AUTHORIZATION PARITY AUDIT (Cross-User Data Isolation)', runner: runAuthParityTests },
    { title: '2. VAULT PIN SECURITY (Salt & 5-Attempt Lockout)', runner: runVaultPinTests },
    { title: '3. WEBSOCKET & LIVE-TRACKING (Token Handshake & 2h Expiry)', runner: runTrackingSecurityTests },
    { title: '4. EVIDENCE VAULT & R2 (Signed URLs & Path Isolation)', runner: runEvidenceR2Tests },
    { title: '5. INPUT VALIDATION & ABUSE PREVENTION (Zod & Cooldown)', runner: runSecurityHardeningTests },
  ];

  for (const suite of suites) {
    console.log(`--- ${suite.title} ---`);
    const results = await suite.runner();
    for (const res of results) {
      totalTests++;
      if (res.passed) {
        passedTests++;
        console.log(`  ✅ [PASS] ${res.name}`);
        console.log(`     └─ ${res.details}`);
      } else {
        failedTests++;
        console.log(`  ❌ [FAIL] ${res.name}`);
        console.log(`     └─ ${res.details}`);
      }
    }
    console.log('');
  }

  console.log(`================================================================`);
  console.log(` Test Summary: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log(` Pass Rate   : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Test Runner Fatal Error]', err);
  process.exit(1);
});
