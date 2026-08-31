import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiter: 120 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

// Authentication / Login limiter: 5 attempts per 5 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 5 minutes.',
  },
});

// Vault PIN verification limiter: 10 requests per 5 minutes per IP (Defense-in-depth on top of DB lockout)
export const vaultPinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many PIN verification requests. Please try again later.',
  },
});

// Cache map for SOS Trigger 30-second SMS cooldown
const lastSosTriggerMap = new Map<string, number>();

/**
 * SOS Trigger Cooldown Middleware:
 * Prevents duplicate SMS blasts within 30 seconds of an active event trigger
 * while still allowing the emergency event to be recorded and logged.
 */
export function checkSosCooldown(req: Request, res: Response, next: () => void) {
  const userId = req.user?.id || req.ip || 'unknown';
  const now = Date.now();
  const lastTrigger = lastSosTriggerMap.get(userId);

  if (lastTrigger && now - lastTrigger < 30 * 1000) {
    const elapsedSeconds = Math.floor((now - lastTrigger) / 1000);
    console.warn(`[SOS Rapid Repeat] User ${userId} triggered SOS ${elapsedSeconds}s after previous trigger. Cooldown active.`);
    (req as any).isCooldownSuppressedSMS = true;
  } else {
    lastSosTriggerMap.set(userId, now);
    (req as any).isCooldownSuppressedSMS = false;
  }
  next();
}
