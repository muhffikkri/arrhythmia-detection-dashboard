-- =============================================================
-- Supabase Schema untuk Arrhythmia Detection Dashboard
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- (atau via: psql "$SUPABASE_CONNECTION_STRING" -f supabase_schema.sql)
-- File ini idempotent: aman dijalankan berulang kali.
-- =============================================================

-- Tabel: sessions --------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid,
  doctor_id   uuid,
  label       text,
  started_at  timestamptz,
  start_time  timestamptz,
  dev_note    text
);

comment on table public.sessions is
  'Sesi rekaman ECG. Sync dari SQLite backend (tabel sessions) via skrip migrasi.';

-- Tabel: frame_records ----------------------------------------------
create table if not exists public.frame_records (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid references public.sessions (id) on delete cascade,
  start_time          timestamptz,
  label               text,
  hidden              boolean not null default false,
  confirmation        boolean,
  doc_classification  text,
  doc_note            text,
  payload             jsonb
);

comment on table public.frame_records is
  'Frame data EKG per sesi. Sync dari SQLite backend via skrip migrasi.';

create index if not exists frame_records_session_idx
  on public.frame_records (session_id);

create index if not exists frame_records_start_time_idx
  on public.frame_records (start_time);

-- RPC: get_sessions_validation_counts --------------------------------
-- Dipakai AdminAnalyticsPage / AdminSessionsPage / AnalyticsPage
create or replace function public.get_sessions_validation_counts(session_ids uuid[])
returns table (session_id uuid, total_frames bigint, validated_frames bigint)
language sql stable
as $$
  select
    fr.session_id,
    count(*)                      as total_frames,
    count(fr.confirmation)        as validated_frames
  from public.frame_records fr
  where fr.session_id = any (session_ids)
  group by fr.session_id;
$$;

-- Grants minimal agar bisa dipanggil via API PostgREST -----------------
grant execute on function public.get_sessions_validation_counts(uuid[]) to anon, authenticated, service_role;

-- Row Level Security (best practice; sesuaikan kebijakan Anda) ----------
alter table public.sessions      enable row level security;
alter table public.frame_records enable row level security;

-- Kebijakan default: layanan (service_role) dapat akses penuh.
-- Tambahkan policy tambahan sesuai kebutuhan peran (pasien/dokter/admin).
drop policy if exists "service_all_sessions" on public.sessions;
create policy "service_all_sessions" on public.sessions
  for all to service_role using (true) with check (true);

drop policy if exists "service_all_frame_records" on public.frame_records;
create policy "service_all_frame_records" on public.frame_records
  for all to service_role using (true) with check (true);

-- Akses anon/authenticated di bawah ini contoh minimal: baca saja.
drop policy if exists "anon_read_sessions" on public.sessions;
create policy "anon_read_sessions" on public.sessions
  for select to anon using (true);

drop policy if exists "anon_read_frame_records" on public.frame_records;
create policy "anon_read_frame_records" on public.frame_records
  for select to anon using (true);