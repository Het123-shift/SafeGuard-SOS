-- ==============================================================================
-- SafeGuard SOS PostgreSQL Database Schema
-- Self-Hosted Migration DDL with Relational Integrity & Performance Indexes
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Core authentication entity)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Profiles Table (Extended profile, medical info, vault security)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  medical_info TEXT,
  emergency_pin_hash TEXT, -- SHA-256(pin_salt || pin)
  pin_salt TEXT,           -- 16-byte random hex salt
  pin_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  date_of_birth TEXT,
  gender TEXT,
  home_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  alternate_phone TEXT,
  blood_type TEXT,
  emergency_notes TEXT,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  location_verified BOOLEAN DEFAULT false,
  profile_complete BOOLEAN DEFAULT false,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Trusted Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  is_priority BOOLEAN DEFAULT false,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SOS Events Table
CREATE TABLE IF NOT EXISTS sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'fall_detection' | 'smartwatch' | 'widget' | 'crash_detected'
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  contacts_notified JSONB DEFAULT '[]'::jsonb,
  resolved BOOLEAN DEFAULT false
);

-- 5. Live Locations Table (Real-time GPS updates for active events)
CREATE TABLE IF NOT EXISTS live_locations (
  sos_event_id UUID PRIMARY KEY REFERENCES sos_events(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 6. Refresh Tokens Table (Rotating session management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tracking Tokens Table (Short-lived public viewer tokens)
CREATE TABLE IF NOT EXISTS tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID REFERENCES sos_events(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Evidence Vault Records Table (Metadata for encrypted files stored in Cloudflare R2)
CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sos_event_id UUID REFERENCES sos_events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Format: {user_id}/{event_id}_{timestamp}.enc
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  encrypted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Email OTP Authentication & Verification Table
CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast scoped queries and index-only scans
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_user_id ON sos_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_triggered_at ON sos_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_tokens_sos_id ON tracking_tokens(sos_id);
CREATE INDEX IF NOT EXISTS idx_evidence_records_user_id ON evidence_records(user_id);
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

