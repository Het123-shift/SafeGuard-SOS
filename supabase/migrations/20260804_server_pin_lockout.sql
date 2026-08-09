-- Server-Side Vault PIN Hashing and Rate-Limited Verification Function
-- Migration: 20260804_server_pin_lockout.sql

-- 1. Ensure columns exist on user_profiles
alter table public.user_profiles 
  add column if not exists emergency_pin_hash text,
  add column if not exists pin_attempts integer default 0,
  add column if not exists locked_until timestamptz;

-- 2. Postgres RPC Function to Set Vault PIN (Hashes PIN server-side)
create or replace function public.set_vault_pin(p_pin text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_salted_hash text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_pin is null or length(p_pin) < 4 then
    return jsonb_build_object('success', false, 'error', 'PIN must be at least 4 digits');
  end if;

  -- Server-side salted SHA-256 digest hashing
  v_salted_hash := encode(digest('Vault_Salt_' || p_pin, 'sha256'), 'hex');

  insert into public.user_profiles (id, emergency_pin_hash, pin_attempts, locked_until)
  values (v_user_id, v_salted_hash, 0, null)
  on conflict (id) do update set
    emergency_pin_hash = v_salted_hash,
    pin_attempts = 0,
    locked_until = null;

  return jsonb_build_object('success', true);
end;
$$;


-- 3. Postgres RPC Function to Verify Vault PIN with 5-Attempt Rate-Limiting
create or replace function public.verify_vault_pin(p_pin text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_stored_hash text;
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

  -- Fetch user profile security data
  select emergency_pin_hash, coalesce(pin_attempts, 0), locked_until
  into v_stored_hash, v_attempts, v_locked_until
  from public.user_profiles
  where id = v_user_id;

  if v_stored_hash is null then
    return jsonb_build_object('success', false, 'error', 'No PIN configured for user');
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

  -- Hash input PIN using server salt
  v_input_hash := encode(digest('Vault_Salt_' || p_pin, 'sha256'), 'hex');

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
