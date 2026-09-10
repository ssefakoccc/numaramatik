-- Numaratik Supabase Security & RLS Migration
-- Idempotent and safe to run multiple times without data loss.

-- 1. Enable Row Level Security (RLS)
alter table public.vehicle_card enable row level security;

-- 2. Revoke insert, update, delete privileges from public roles
revoke insert, update, delete on table public.vehicle_card from anon, authenticated;

-- 3. Remove existing policies idempotently
drop policy if exists "Allow public read-only access to vehicle card" on public.vehicle_card;
drop policy if exists "Allow service role update on vehicle card" on public.vehicle_card;

-- 4. Allow public (anon & authenticated) to ONLY read the vehicle card
create policy "Allow public read-only access to vehicle card"
  on public.vehicle_card
  for select
  to public
  using (slug = 'arac');

-- 5. Explicitly ensure service_role has update privileges
grant all on table public.vehicle_card to service_role;
grant select on table public.vehicle_card to anon, authenticated;
