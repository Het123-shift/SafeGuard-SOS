-- Migration: Per-User Cryptographically Random Salt for Vault PIN Hashing
-- File: 20260804_per_user_pin_salt.sql

-- Ensure pgcrypto extension is enabled for gen_random_bytes and digest functions
create extension if not exists pgcrypto;

-- 1. Add pin_salt column to user_profiles
alter table public.user_profiles 
  add column if not exists pin_salt text;

-- 2. Invalidate pre-existing PIN hashes (shared salt values are no longer valid)
-- Forces all users to re-set their 4-digit PIN on next vault access
update public.user_profiles
set emergency_pin_hash = null,
    pin_salt = null,
    pin_attempts = 0,
    locked_until = null;

-- 3. Replace set_vault_pin RPC: Generates a unique 16-byte random salt per user call
create or replace function public.set_vault_pin(p_pin text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_random_salt text;
  v_salted_hash text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_pin is null or length(p_pin) < 4 then
    return jsonb_build_object('success', false, 'error', 'PIN must be at least 4 digits');
  end if;

  -- Generate a 16-byte cryptographically random salt per user call
  v_random_salt := encode(gen_random_bytes(16), 'hex');

  -- Compute SHA-256 digest of (v_random_salt || p_pin)
  v_salted_hash := encode(digest(v_random_salt || p_pin, 'sha256'), 'hex');

  insert into public.user_profiles (id, emergency_pin_hash, pin_salt, pin_attempts, locked_until)
  values (v_user_id, v_salted_hash, v_random_salt, 0, null)
  on conflict (id) do update set
    emergency_pin_hash = v_salted_hash,
    pin_salt = v_random_salt,
    pin_attempts = 0,
    locked_until = null;

  return jsonb_build_object('success', true);
end;
$$;

-- 4. Replace verify_vault_pin RPC: Uses caller's stored per-user random salt
create or replace function public.verify_vault_pin(p_pin text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_stored_hash text;
  v_stored_salt text;
  v_attempts integer;
  v_locked_until timestamptz;
  v_input_hash text;
  v_max_attempts integer := 5;
  v_lockout_duration interval := interval '5 minutes';
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- Fetch user profile security data including per-user salt
  select emergency_pin_hash, pin_salt, coalesce(pin_attempts, 0), locked_until
  into v_stored_hash, v_stored_salt, v_attempts, v_locked_until
  from public.user_profiles
  where id = v_user_id;

  -- If PIN or salt is null, user needs to set a PIN
  if v_stored_hash is null or v_stored_salt is null then
    return jsonb_build_object(
      'success', false,
      'requires_pin_setup', true,
      'error', 'No PIN configured for user'
    );
  end if;

  -- Check if user is currently locked out
  if v_locked_until is not null and now() < v_locked_until then
    return jsonb_build_object(
      'success', false,
      'is_locked_out', true,
      'remaining_seconds', extract(epoch from (v_locked_until - now()))::integer,
      'error', 'Vault locked out due to too many failed attempts'
    );
  end if;

  -- Compute SHA-256 hash using the user's unique random salt
  v_input_hash := encode(digest(v_stored_salt || p_pin, 'sha256'), 'hex');

  if v_input_hash = v_stored_hash then
    -- Successful verification: Reset attempts and lockout
    update public.user_profiles
    set pin_attempts = 0, locked_until = null
    where id = v_user_id;

    return jsonb_build_object('success', true, 'is_locked_out', false, 'attempts_left', v_max_attempts);
  else
    -- Failed attempt: Increment counter
    v_attempts := v_attempts + 1;
    
    if v_attempts >= v_max_attempts then
      v_locked_until := now() + v_lockout_duration;
      update public.user_profiles
      set pin_attempts = v_attempts, locked_until = v_locked_until
      where id = v_user_id;

      return jsonb_build_object(
        'success', false,
        'is_locked_out', true,
        'remaining_seconds', 300,
        'attempts_left', 0,
        'error', 'Too many failed attempts. Vault locked for 5 minutes.'
      );
    else
      update public.user_profiles
      set pin_attempts = v_attempts
      where id = v_user_id;

      return jsonb_build_object(
        'success', false,
        'is_locked_out', false,
        'attempts_left', v_max_attempts - v_attempts,
        'error', 'Incorrect PIN'
      );
    end if;
  end if;
end;
$$;
