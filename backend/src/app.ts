import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import contactsRoutes from './routes/contacts.routes';
import profileRoutes from './routes/profile.routes';
import sosRoutes from './routes/sos.routes';
import vaultRoutes from './routes/vault.routes';
import evidenceRoutes from './routes/evidence.routes';
import smsRoutes from './routes/sms.routes';
import trackingRoutes from './routes/tracking.routes';

export const app = express();

// Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Strict CORS (Configured origins, no wildcard in production)
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile native apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS Error: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tracking-token', 'x-client-version'],
}));

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General Rate Limiting
app.use('/api', apiLimiter);

// Root API Status Endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'SafeGuard SOS Security Backend',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      contacts: '/api/contacts',
      profile: '/api/profile',
      sos: '/api/sos',
      vault: '/api/vault',
      evidence: '/api/evidence',
      sms: '/api/sms',
      track: '/api/track',
    },
  });
});

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'safeguard-sos-backend',
    version: '1.0.0',
  });
});

// Mount Application Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/track', trackingRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Unknown error',
  });
});
