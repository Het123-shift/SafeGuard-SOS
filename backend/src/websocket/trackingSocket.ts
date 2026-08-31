import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { env } from '../config/env';

interface TrackingHandshakeAuth {
  sosId?: string;
  token?: string; // Tracking token or User JWT
}

export function initTrackingSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Socket.IO Handshake Authentication Middleware
  io.use(async (socket: Socket, next) => {
    const auth = (socket.handshake.auth || {}) as TrackingHandshakeAuth;
    const queryParams = (socket.handshake.query || {}) as TrackingHandshakeAuth;
    const sosId = auth.sosId || queryParams.sosId;
    const token = auth.token || queryParams.token;

    if (!sosId) {
      return next(new Error('Authentication Error: Missing sosId in handshake'));
    }

    if (!token) {
      return next(new Error('Authentication Error: Missing tracking token or auth token'));
    }

    try {
      // Option A: Check if token is a valid User JWT (Owner Mode)
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        if (decoded && decoded.sub) {
          const ownerCheck = await query('SELECT id FROM sos_events WHERE id = $1 AND user_id = $2', [sosId, decoded.sub]);
          if (ownerCheck.rows.length > 0) {
            (socket as any).isOwner = true;
            (socket as any).userId = decoded.sub;
            (socket as any).sosId = sosId;
            return next();
          }
        }
      } catch {
        // Not a JWT, check if it's a tracking token
      }

      // Option B: Validate as short-lived Tracking Token (Contact / Viewer Mode)
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenResult = await query(
        `SELECT t.id, t.sos_id, t.expires_at, l.is_active, l.expires_at as "locExpiresAt"
         FROM tracking_tokens t
         LEFT JOIN live_locations l ON t.sos_id = l.sos_event_id
         WHERE t.sos_id = $1 AND t.token_hash = $2`,
        [sosId, tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        return next(new Error('Authentication Error: Invalid or unrecognized tracking token'));
      }

      const record = tokenResult.rows[0];
      const now = new Date();

      // Server-side 2-hour hard expiry check
      if (now > new Date(record.expires_at) || (record.locExpiresAt && now > new Date(record.locExpiresAt))) {
        return next(new Error('Authentication Error: Live tracking session has expired (2-hour limit reached)'));
      }

      (socket as any).isOwner = false;
      (socket as any).sosId = sosId;
      (socket as any).expiresAt = new Date(record.expires_at);

      next();
    } catch (err: any) {
      console.error('[Socket Handshake Auth Error]', err);
      next(new Error('Authentication Error: Internal server error during handshake'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const sosId = (socket as any).sosId;
    const isOwner = (socket as any).isOwner;
    const expiresAt = (socket as any).expiresAt as Date | undefined;

    const roomName = `sos_${sosId}`;
    socket.join(roomName);
    console.log(`[Socket.IO] Client connected to ${roomName} (isOwner=${isOwner}, socketId=${socket.id})`);

    // Schedule server-side hard disconnect upon 2-hour expiration
    let expiryTimer: NodeJS.Timeout | null = null;
    if (expiresAt) {
      const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());
      expiryTimer = setTimeout(() => {
        console.log(`[Socket.IO] 2-Hour Expiry reached for ${roomName}. Disconnecting socket ${socket.id}`);
        socket.emit('session_expired', { error: 'Tracking session has expired after 2 hours' });
        socket.disconnect(true);
      }, remainingMs);
    }

    // Event: User pushes live location update over WebSocket
    socket.on('location_update', async (data: { latitude: number; longitude: number; isActive?: boolean }) => {
      const { latitude, longitude, isActive = true } = data;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        socket.emit('error', { message: 'Invalid latitude or longitude' });
        return;
      }

      try {
        // Enforce 2-hour server-side expiration check on incoming updates
        const locResult = await query(
          'SELECT expires_at FROM live_locations WHERE sos_event_id = $1',
          [sosId]
        );

        if (locResult.rows.length > 0 && new Date() > new Date(locResult.rows[0].expires_at)) {
          console.warn(`[Socket.IO] Rejected location update for expired session ${sosId}`);
          socket.emit('session_expired', { error: 'Session expired' });
          socket.disconnect(true);
          return;
        }

        const now = new Date().toISOString();

        // Update database
        await query(
          `UPDATE live_locations
           SET latitude = $1, longitude = $2, updated_at = now(), is_active = $3
           WHERE sos_event_id = $4`,
          [latitude, longitude, isActive, sosId]
        );

        // Broadcast to all viewers in the room
        io.to(roomName).emit('location_changed', {
          sosId,
          latitude,
          longitude,
          isActive,
          updatedAt: now,
        });

        console.log(`[Socket.IO] Broadcasted GPS update for ${sosId}: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      } catch (err: any) {
        console.error('[Socket.IO location_update Error]', err);
      }
    });

    socket.on('disconnect', () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      console.log(`[Socket.IO] Client disconnected from ${roomName} (${socket.id})`);
    });
  });

  return io;
}
