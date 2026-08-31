import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { vaultPinLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(requireAuth);

const pinSchema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(12, 'PIN must be at most 12 digits'),
});

// POST /api/vault/pin/set - Set Vault PIN with per-user random salt
router.post('/pin/set', validateBody(pinSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { pin } = req.body;

  try {
    // Generate 16-byte cryptographically random salt per user
    const randomSalt = crypto.randomBytes(16).toString('hex');
    const saltedHash = crypto.createHash('sha256').update(randomSalt + pin).digest('hex');

    await query(
      `INSERT INTO user_profiles (id, emergency_pin_hash, pin_salt, pin_attempts, locked_until)
       VALUES ($1, $2, $3, 0, null)
       ON CONFLICT (id) DO UPDATE SET
         emergency_pin_hash = $2,
         pin_salt = $3,
         pin_attempts = 0,
         locked_until = null`,
      [userId, saltedHash, randomSalt]
    );

    res.json({ success: true, message: 'Vault PIN set successfully' });
  } catch (err: any) {
    console.error('[Vault Set PIN Error]', err);
    res.status(500).json({ success: false, error: 'Failed to set Vault PIN' });
  }
});

// POST /api/vault/pin/verify - Verify Vault PIN with attempt lockout
router.post('/pin/verify', vaultPinLimiter, validateBody(pinSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { pin } = req.body;
  const maxAttempts = 5;
  const lockoutDurationSeconds = 300; // 5 minutes

  try {
    const result = await query(
      'SELECT emergency_pin_hash, pin_salt, COALESCE(pin_attempts, 0) as pin_attempts, locked_until FROM user_profiles WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].emergency_pin_hash || !result.rows[0].pin_salt) {
      res.status(400).json({
        success: false,
        requires_pin_setup: true,
        error: 'No PIN configured for this account',
      });
      return;
    }

    const { emergency_pin_hash: storedHash, pin_salt: storedSalt, pin_attempts: rawAttempts, locked_until: lockedUntil } = result.rows[0];
    let attempts = parseInt(rawAttempts, 10);

    const now = new Date();

    // Check if account is currently locked out
    if (lockedUntil && now < new Date(lockedUntil)) {
      const remainingSeconds = Math.ceil((new Date(lockedUntil).getTime() - now.getTime()) / 1000);
      res.status(423).json({
        success: false,
        is_locked_out: true,
        remaining_seconds: remainingSeconds,
        attempts_left: 0,
        error: 'Vault locked out due to too many failed attempts',
      });
      return;
    }

    // Compute hash with user's stored per-user random salt
    const inputHash = crypto.createHash('sha256').update(storedSalt + pin).digest('hex');

    if (inputHash === storedHash) {
      // Success: Reset failed attempts and lockout
      await query(
        'UPDATE user_profiles SET pin_attempts = 0, locked_until = null WHERE id = $1',
        [userId]
      );

      res.json({
        success: true,
        is_locked_out: false,
        attempts_left: maxAttempts,
      });
      return;
    }

    // Failure: Increment failed attempts
    attempts += 1;

    if (attempts >= maxAttempts) {
      const lockUntilDate = new Date(Date.now() + lockoutDurationSeconds * 1000);
      await query(
        'UPDATE user_profiles SET pin_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntilDate, userId]
      );

      res.status(423).json({
        success: false,
        is_locked_out: true,
        remaining_seconds: lockoutDurationSeconds,
        attempts_left: 0,
        error: 'Too many failed attempts. Vault locked for 5 minutes.',
      });
      return;
    }

    await query(
      'UPDATE user_profiles SET pin_attempts = $1 WHERE id = $2',
      [attempts, userId]
    );

    res.status(401).json({
      success: false,
      is_locked_out: false,
      attempts_left: maxAttempts - attempts,
      error: 'Incorrect PIN',
    });
  } catch (err: any) {
    console.error('[Vault Verify PIN Error]', err);
    res.status(500).json({ success: false, error: 'Internal Vault verification error' });
  }
});

// GET /api/vault/pin/status - Check if PIN is configured & lockout status
router.get('/pin/status', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await query(
      'SELECT emergency_pin_hash, pin_salt, COALESCE(pin_attempts, 0) as pin_attempts, locked_until FROM user_profiles WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].emergency_pin_hash) {
      res.json({ success: true, hasPin: false, isLockedOut: false, remainingSeconds: 0 });
      return;
    }

    const { locked_until: lockedUntil } = result.rows[0];
    const now = new Date();
    const isLockedOut = lockedUntil ? now < new Date(lockedUntil) : false;
    const remainingSeconds = isLockedOut ? Math.ceil((new Date(lockedUntil).getTime() - now.getTime()) / 1000) : 0;

    res.json({
      success: true,
      hasPin: true,
      isLockedOut,
      remainingSeconds,
    });
  } catch (err: any) {
    console.error('[Vault PIN Status Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve PIN status' });
  }
});

export default router;
