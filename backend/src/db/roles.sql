-- ==============================================================================
-- SafeGuard SOS Least-Privilege Database Role Configuration
-- ==============================================================================
-- Run as postgres superuser during initial provisioning:

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'safeguard_app') THEN

      CREATE ROLE safeguard_app WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_RANDOM_PASSWORD';
   END IF;
END
$do$;

-- Revoke all privileges on database and schema from public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO safeguard_app;

-- Grant minimal necessary DML privileges on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO safeguard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO safeguard_app;

-- Grant minimal sequence usage for autoincrement / UUIDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO safeguard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO safeguard_app;
