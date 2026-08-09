-- Migration: Initialize SafeGuard SOS Schema, RLS Policies, and Evidence Storage Bucket

-- 1. Contacts Table
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text not null,
  is_priority boolean default false,
  created_at timestamptz default now()
);

alter table public.contacts enable row level security;

create policy "Users can read own contacts" on public.contacts
  for select using (auth.uid() = user_id);

create policy "Users can insert own contacts" on public.contacts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own contacts" on public.contacts
  for update using (auth.uid() = user_id);

create policy "Users can delete own contacts" on public.contacts
  for delete using (auth.uid() = user_id);


-- 2. SOS Events Table
create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  triggered_at timestamptz default now(),
  trigger_type text not null default 'manual', -- 'manual' | 'fall_detected' | 'crash_detected'
  latitude double precision,
  longitude double precision,
  contacts_notified jsonb, -- array of {phone, status, messageSid, error}
  resolved boolean default false
);

alter table public.sos_events enable row level security;

create policy "Users can read own sos events" on public.sos_events
  for select using (auth.uid() = user_id);

create policy "Users can insert own sos events" on public.sos_events
  for insert with check (auth.uid() = user_id);

create policy "Users can update own sos events" on public.sos_events
  for update using (auth.uid() = user_id);


-- 3. User Profiles Table
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  medical_info text,
  emergency_pin_hash text, -- Salted hash of 4-digit PIN (NEVER plain text)
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id);


-- 4. Storage Bucket: Evidence (Authenticated Access Only)
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = false;

-- RLS Policy for Evidence Bucket: Access restricted to owning user's folder path: {user_id}/*
create policy "Users can upload own evidence files"
on storage.objects for insert
with check (
  bucket_id = 'evidence'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can read own evidence files"
on storage.objects for select
using (
  bucket_id = 'evidence'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own evidence files"
on storage.objects for delete
using (
  bucket_id = 'evidence'
  and auth.uid()::text = (storage.foldername(name))[1]
);
