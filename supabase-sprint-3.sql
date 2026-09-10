-- Numaratik Sprint 3: Vehicle Events Table & RLS Security Migration
-- Idempotent and safe to run multiple times.

create table if not exists public.vehicle_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_slug text not null default 'arac',
  event_type text not null check (event_type in ('scan', 'scenario', 'admin_failed')),
  reason text null check (reason is null or reason in ('Aracı çekebilir misiniz?', 'Cam veya far açık', 'Geçiş engelleniyor', 'Acil iletişim')),
  fingerprint_hash text not null,
  device_label text not null default 'Bilinmiyor',
  created_at timestamptz not null default now()
);

-- Indexes for performance & deduplication/rate-limit lookups
create index if not exists idx_vehicle_events_fp_type_created
  on public.vehicle_events (fingerprint_hash, event_type, created_at desc);

create index if not exists idx_vehicle_events_slug_created
  on public.vehicle_events (vehicle_slug, created_at desc);

-- Security & RLS
alter table public.vehicle_events enable row level security;

-- Revoke all direct public access
revoke all on table public.vehicle_events from public, anon, authenticated;

-- Ensure service_role and authenticator have access for server-side & PostgREST operations
grant all on table public.vehicle_events to service_role, authenticator;

-- Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';
