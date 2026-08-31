import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db';
import { env } from '../config/env';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { EmailService } from '../services/emailService';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  dateOfBirth: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  homeAddress: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  country: z.string().optional().default(''),
  postalCode: z.string().optional().default(''),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
}

function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

// POST /api/auth/register
router.post('/register', authLimiter, validateBody(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const {
    email, password, fullName, phone,
    dateOfBirth, gender, homeAddress, city, state, country, postalCode
  } = req.body;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'User with this email already exists' });
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase(), passwordHash]
    );
    const newUser = userResult.rows[0];

    // Create associated user_profile with extended fields
    await query(
      `INSERT INTO user_profiles (
         id, full_name, phone, date_of_birth, gender,
         home_address, city, state, country, postal_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newUser.id,
        fullName || email.split('@')[0],
        phone,
        dateOfBirth,
        gender,
        homeAddress,
        city,
        state,
        country,
        postalCode,
      ]
    );

    const accessToken = generateAccessToken(newUser.id, newUser.email);
    const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [newUser.id, refreshHash, expiresAt]
    );

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: fullName || email.split('@')[0],
        phone: phone || '',
        createdAt: newUser.created_at,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_EXPIRES_IN,
      },
    });
  } catch (err: any) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ success: false, error: 'Failed to create user account' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const userResult = await query(
      `SELECT u.id, u.email, u.password_hash, u.created_at,
              p.full_name, p.phone, p.medical_info, p.date_of_birth, p.gender,
              p.home_address, p.city, p.state, p.country, p.postal_code, p.alternate_phone,
              p.phone_verified, p.location_verified, p.profile_complete, p.location_lat, p.location_lng
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const user = userResult.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshHash, expiresAt]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || '',
        phone: user.phone || '',
        medicalInfo: user.medical_info || '',
        dateOfBirth: user.date_of_birth || '',
        gender: user.gender || '',
        homeAddress: user.home_address || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        postalCode: user.postal_code || '',
        alternatePhone: user.alternate_phone || '',
        phoneVerified: user.phone_verified || false,
        locationVerified: user.location_verified || false,
        profileComplete: user.profile_complete || false,
        locationLat: user.location_lat,
        locationLng: user.location_lng,
        createdAt: user.created_at,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_EXPIRES_IN,
      },
    });
  } catch (err: any) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ success: false, error: 'Internal login server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validateBody(refreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  try {
    const tokenResult = await query(
      `SELECT r.id, r.user_id, r.expires_at, r.revoked, u.email
       FROM refresh_tokens r
       JOIN users u ON r.user_id = u.id
       WHERE r.token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const record = tokenResult.rows[0];
    if (record.revoked || new Date() > new Date(record.expires_at)) {
      res.status(401).json({ success: false, error: 'Refresh token expired or revoked' });
      return;
    }

    // Revoke old refresh token (Token rotation)
    await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);

    // Issue new access & refresh tokens
    const newAccessToken = generateAccessToken(record.user_id, record.email);
    const { token: newRefreshToken, hash: newRefreshHash, expiresAt } = generateRefreshToken();

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [record.user_id, newRefreshHash, expiresAt]
    );

    res.json({
      success: true,
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: env.JWT_EXPIRES_IN,
      },
    });
  } catch (err: any) {
    console.error('[Auth Refresh Error]', err);
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', validateBody(refreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  try {
    await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('[Auth Logout Error]', err);
    res.status(500).json({ success: false, error: 'Failed to logout' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  try {
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!passwordValid) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, userId]);

    // Revoke existing refresh tokens
    await query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('[Auth Change Password Error]', err);
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().min(4, 'OTP must be at least 4 digits').max(8, 'OTP too long'),
});

// POST /api/auth/otp/send
router.post('/otp/send', authLimiter, validateBody(sendOtpSchema), async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 30-second rapid repeat cooldown check
    const recentOtp = await query(
      `SELECT created_at FROM email_otps 
       WHERE email = $1 AND created_at > now() - INTERVAL '30 seconds' 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (recentOtp.rows.length > 0) {
      res.status(429).json({
        success: false,
        error: 'Please wait 30 seconds before requesting another code.',
      });
      return;
    }

    // Generate 4-digit cryptographic OTP code
    const rawOtp = crypto.randomInt(1000, 10000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in database
    await query(
      `INSERT INTO email_otps (email, otp_hash, expires_at) 
       VALUES ($1, $2, $3)`,
      [normalizedEmail, otpHash, expiresAt]
    );

    // Send email
    await EmailService.sendOTP(normalizedEmail, rawOtp);

    res.json({
      success: true,
      message: 'Verification code sent successfully.',
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    console.error('[Auth Send OTP Error]', err);
    res.status(500).json({ success: false, error: 'Failed to dispatch verification code' });
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', authLimiter, validateBody(verifyOtpSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const submittedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

  try {
    // Find active unexpired OTP record
    const otpResult = await query(
      `SELECT id, otp_hash, attempts, expires_at 
       FROM email_otps 
       WHERE email = $1 AND expires_at > now() 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (otpResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Verification code is invalid or has expired. Please request a new code.',
      });
      return;
    }

    const activeOtp = otpResult.rows[0];

    // Max 5 attempts lockout
    if (activeOtp.attempts >= 5) {
      res.status(429).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.',
      });
      return;
    }

    if (activeOtp.otp_hash !== submittedHash) {
      const remainingAttempts = 4 - activeOtp.attempts;
      await query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [activeOtp.id]);
      res.status(400).json({
        success: false,
        error: `Incorrect code. ${Math.max(0, remainingAttempts)} attempts remaining.`,
      });
      return;
    }

    // Success: Delete used OTPs for this email
    await query('DELETE FROM email_otps WHERE email = $1', [normalizedEmail]);

    // Check if user exists in database
    let userResult = await query(
      `SELECT u.id, u.email, u.created_at, p.full_name, p.phone, p.gender, p.blood_type,
              p.emergency_notes, p.city, p.home_address, p.email_verified, p.phone_verified,
              p.location_verified, p.profile_complete, p.created_at as profile_created_at
       FROM users u
       LEFT JOIN user_profiles p ON p.id = u.id
       WHERE u.email = $1`,
      [normalizedEmail]
    );

    let userObj: any = null;

    if (userResult.rows.length === 0) {
      // Auto-provision user account with random secure password
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      const newUser = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [normalizedEmail, passwordHash]
      );
      const createdUser = newUser.rows[0];

      await query(
        `INSERT INTO user_profiles (id, full_name, email_verified, profile_complete)
         VALUES ($1, $2, true, false)`,
        [createdUser.id, normalizedEmail.split('@')[0]]
      );

      userObj = {
        id: createdUser.id,
        email: createdUser.email,
        fullName: normalizedEmail.split('@')[0],
        phone: '',
        gender: '',
        bloodType: '',
        emergencyNotes: '',
        city: '',
        homeAddress: '',
        emailVerified: true,
        phoneVerified: false,
        locationVerified: false,
        profileComplete: false,
        createdAt: createdUser.created_at,
      };
    } else {
      const row = userResult.rows[0];
      // Mark email verified in user_profiles
      await query('UPDATE user_profiles SET email_verified = true, updated_at = now() WHERE id = $1', [row.id]);

      userObj = {
        id: row.id,
        email: row.email,
        fullName: row.full_name || normalizedEmail.split('@')[0],
        phone: row.phone || '',
        gender: row.gender || '',
        bloodType: row.blood_type || '',
        emergencyNotes: row.emergency_notes || '',
        city: row.city || '',
        homeAddress: row.home_address || '',
        emailVerified: true,
        phoneVerified: row.phone_verified || false,
        locationVerified: row.location_verified || false,
        profileComplete: row.profile_complete || false,
        createdAt: row.created_at,
      };
    }

    // Generate JWT access & refresh tokens
    const accessToken = generateAccessToken(userObj.id, userObj.email);
    const { token: refreshToken, hash: refreshHash, expiresAt: refreshExpiresAt } = generateRefreshToken();

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userObj.id, refreshHash, refreshExpiresAt]
    );

    res.json({
      success: true,
      message: 'Email successfully verified.',
      user: userObj,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_EXPIRES_IN,
      },
    });
  } catch (err: any) {
    console.error('[Auth Verify OTP Error]', err);
    res.status(500).json({ success: false, error: 'Failed to verify code' });
  }
});

export default router;
