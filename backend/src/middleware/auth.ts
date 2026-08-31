import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface JWTPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Authentication middleware: Validates JWT access token and sets req.user.
 * Replaces Supabase Auth middleware.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authorization header with Bearer token is required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    if (!payload.sub) {
      res.status(401).json({ success: false, error: 'Invalid token claims' });
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid authentication token' });
    return;
  }
}
