import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://postgres:postgres@localhost:5432/safeguard_sos'),
  
  // JWT Configuration (Minimum 32 chars in production)
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('super_secret_jwt_key_at_least_32_bytes_long_safeguard_2026'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default('super_secret_refresh_jwt_key_at_least_32_bytes_long_safeguard_2026'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.string().default('7').transform((val) => parseInt(val, 10)),

  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().default('safeguard-evidence'),
  R2_ENDPOINT: z.string().optional().default(''),

  // Twilio Backup SMS
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),

  // MSG91 Backup SMS
  MSG91_AUTH_KEY: z.string().optional().default(''),
  MSG91_SENDER_ID: z.string().default('SOSALT'),

  // CORS Allowed Origins
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006,https://safeguard-sos.app'),

  // Email Dispatch Providers (Resend, SendGrid, SMTP)
  RESEND_API_KEY: z.string().optional().default(''),
  SENDGRID_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('SafeGuard SOS <alerts@safeguard-sos.app>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().optional().default('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
});

export const env = envSchema.parse(process.env);
