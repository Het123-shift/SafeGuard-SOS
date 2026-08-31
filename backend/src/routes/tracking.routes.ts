import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db';

const router = Router();

// GET /api/track/:sosId - Public/Token-authorized Live Tracking snapshot
router.get('/:sosId', async (req: Request, res: Response): Promise<void> => {
  const { sosId } = req.params;
  const token = req.query.token as string | undefined;

  try {
    // 1. Verify tracking token if token is provided
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenCheck = await query(
        'SELECT id, expires_at FROM tracking_tokens WHERE sos_id = $1 AND token_hash = $2',
        [sosId, tokenHash]
      );

      if (tokenCheck.rows.length === 0) {
        res.status(403).json({ success: false, error: 'Invalid tracking token' });
        return;
      }
    }

    // 2. Fetch live location and event metadata
    const result = await query(
      `SELECT l.sos_event_id, l.latitude, l.longitude, l.updated_at, l.is_active, l.expires_at,
              e.triggered_at, e.trigger_type, e.resolved,
              p.full_name as "userName"
       FROM live_locations l
       JOIN sos_events e ON l.sos_event_id = e.id
       JOIN user_profiles p ON e.user_id = p.id
       WHERE l.sos_event_id = $1`,
      [sosId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No live tracking session found for this SOS ID' });
      return;
    }

    const row = result.rows[0];
    const now = new Date();
    const isExpired = row.expires_at ? now > new Date(row.expires_at) : false;
    const isTrackingActive = row.is_active && !row.resolved && !isExpired;

    res.json({
      success: true,
      sosId: row.sos_event_id,
      userName: row.userName || 'SafeGuard User',
      latitude: row.latitude,
      longitude: row.longitude,
      updatedAt: row.updated_at,
      isActive: isTrackingActive,
      isExpired,
      expiresAt: row.expires_at,
      triggerType: row.trigger_type,
      resolved: row.resolved,
    });
  } catch (err: any) {
    console.error('[Track Route Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve tracking information' });
  }
});

export default router;
