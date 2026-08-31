import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkSosCooldown } from '../middleware/rateLimiter';
import { SMSService } from '../services/smsService';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);

const triggerSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional().default(''),
  triggerType: z.enum(['manual', 'fall_detection', 'smartwatch', 'widget', 'crash_detected']).optional().default('manual'),
  contactPhones: z.array(z.string()).optional().default([]),
});

const locationUpdateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean().optional().default(true),
});

// Helper to generate a short-lived tracking token
export function generateTrackingToken(sosId: string): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiry
  return { token, tokenHash, expiresAt };
}

// POST /api/sos/trigger - Trigger an emergency SOS event
router.post('/trigger', checkSosCooldown, validateBody(triggerSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { latitude, longitude, address, triggerType, contactPhones } = req.body;
  const isCooldownSuppressed = (req as any).isCooldownSuppressedSMS;

  try {
    // 1. Generate UUID v4 for the SOS event
    const sosId = crypto.randomUUID();

    // 2. Fetch User name for SMS
    const userResult = await query('SELECT full_name FROM user_profiles WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.full_name || req.user!.email.split('@')[0] || 'SafeGuard User';

    // 3. Generate short-lived (2-hour) tracking token
    const { token: trackingToken, tokenHash, expiresAt } = generateTrackingToken(sosId);

    // 4. Compute tracking URL
    const trackingUrl = `https://safeguard-sos.app/track/${sosId}?token=${trackingToken}`;

    // 5. Secondary SMS dispatch (unless suppressed by 30s cooldown)
    let smsResults: any[] = [];
    if (contactPhones && contactPhones.length > 0) {
      if (isCooldownSuppressed) {
        console.log(`[SOS Trigger] SMS dispatch suppressed by 30s cooldown for user ${userId}`);
        smsResults = contactPhones.map((p: string) => ({
          phone: p,
          status: 'cooldown_suppressed',
          messageSid: 'suppressed_by_30s_cooldown',
        }));
      } else {
        const smsResponse = await SMSService.dispatchSOSEmergencySMS(
          userName,
          latitude,
          longitude,
          contactPhones,
          trackingUrl
        );
        smsResults = smsResponse.results;
      }
    }

    // 6. Insert SOS Event record
    const eventResult = await query(
      `INSERT INTO sos_events (id, user_id, triggered_at, trigger_type, latitude, longitude, address, contacts_notified, resolved)
       VALUES ($1, $2, now(), $3, $4, $5, $6, $7, false)
       RETURNING id, user_id, triggered_at as "triggeredAt", trigger_type as "triggerType",
                 latitude, longitude, address, contacts_notified as "contactsNotified", resolved`,
      [sosId, userId, triggerType, latitude, longitude, address, JSON.stringify(smsResults)]
    );

    // 7. Insert initial live location with 2-hour hard expiration
    await query(
      `INSERT INTO live_locations (sos_event_id, latitude, longitude, updated_at, is_active, expires_at)
       VALUES ($1, $2, $3, now(), true, $4)
       ON CONFLICT (sos_event_id) DO UPDATE SET
         latitude = $2,
         longitude = $3,
         updated_at = now(),
         is_active = true,
         expires_at = $4`,
      [sosId, latitude, longitude, expiresAt]
    );

    // 8. Store tracking token in DB
    await query(
      'INSERT INTO tracking_tokens (sos_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [sosId, tokenHash, expiresAt]
    );

    res.status(201).json({
      success: true,
      sosEvent: eventResult.rows[0],
      sosId,
      trackingToken,
      trackingUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error('[SOS Trigger Error]', err);
    res.status(500).json({ success: false, error: 'Failed to trigger SOS event' });
  }
});

// GET /api/sos/events - List user's SOS event history (Strictly scoped to req.user.id)
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await query(
      `SELECT id, triggered_at as "triggeredAt", resolved_at as "resolvedAt",
              trigger_type as "triggerType", latitude, longitude, address as "location",
              contacts_notified as "contactsNotified", resolved
       FROM sos_events
       WHERE user_id = $1
       ORDER BY triggered_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ success: true, events: result.rows });
  } catch (err: any) {
    console.error('[SOS Events List Error]', err);
    res.status(500).json({ success: false, error: 'Failed to list SOS events' });
  }
});

// GET /api/sos/events/:id - Get specific SOS event
router.get('/events/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const sosId = req.params.id;

  try {
    const result = await query(
      `SELECT id, user_id, triggered_at as "triggeredAt", resolved_at as "resolvedAt",
              trigger_type as "triggerType", latitude, longitude, address,
              contacts_notified as "contactsNotified", resolved
       FROM sos_events
       WHERE id = $1 AND user_id = $2`,
      [sosId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'SOS event not found or unauthorized' });
      return;
    }

    res.json({ success: true, event: result.rows[0] });
  } catch (err: any) {
    console.error('[SOS Event Detail Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve SOS event' });
  }
});

// PUT /api/sos/events/:id/resolve - Resolve active SOS event
router.put('/events/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const sosId = req.params.id;

  try {
    const result = await query(
      `UPDATE sos_events
       SET resolved = true, resolved_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, resolved, resolved_at as "resolvedAt"`,
      [sosId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'SOS event not found or unauthorized' });
      return;
    }

    // Deactivate live location
    await query('UPDATE live_locations SET is_active = false WHERE sos_event_id = $1', [sosId]);

    res.json({ success: true, message: 'SOS event resolved successfully' });
  } catch (err: any) {
    console.error('[SOS Resolve Error]', err);
    res.status(500).json({ success: false, error: 'Failed to resolve SOS event' });
  }
});

// POST /api/sos/events/:id/location - Update live location GPS coordinates
router.post('/events/:id/location', validateBody(locationUpdateSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const sosId = req.params.id;
  const { latitude, longitude, isActive } = req.body;

  try {
    // 1. Verify user owns this SOS event
    const eventCheck = await query('SELECT id FROM sos_events WHERE id = $1 AND user_id = $2', [sosId, userId]);
    if (eventCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'SOS event not found or unauthorized' });
      return;
    }

    // 2. Check 2-hour expiration on live location
    const locResult = await query(
      `SELECT expires_at FROM live_locations WHERE sos_event_id = $1`,
      [sosId]
    );

    if (locResult.rows.length > 0 && new Date() > new Date(locResult.rows[0].expires_at)) {
      res.status(410).json({ success: false, error: 'Live tracking session has expired' });
      return;
    }

    // 3. Upsert live location
    await query(
      `UPDATE live_locations
       SET latitude = $1, longitude = $2, updated_at = now(), is_active = $3
       WHERE sos_event_id = $4`,
      [latitude, longitude, isActive, sosId]
    );

    res.json({ success: true, message: 'Live location updated' });
  } catch (err: any) {
    console.error('[SOS Location Update Error]', err);
    res.status(500).json({ success: false, error: 'Failed to update live location' });
  }
});

export default router;
