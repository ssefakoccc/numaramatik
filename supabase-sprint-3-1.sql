-- Numaratik Sprint 3.1: Ultra-Fast Atomic Dedup RPC & Composite Indexes
-- Idempotent and safe to run multiple times without data loss.

-- 1. Composite indexes for ultra-fast dedup lookups
create index if not exists idx_vehicle_events_dedup_scan
  on public.vehicle_events (vehicle_slug, fingerprint_hash, event_type, created_at desc);

create index if not exists idx_vehicle_events_dedup_scenario
  on public.vehicle_events (vehicle_slug, fingerprint_hash, event_type, reason, created_at desc);

-- 2. Atomic check-and-log function with transaction-scoped advisory lock
create or replace function public.log_vehicle_event_if_not_deduped(
  p_slug text,
  p_event_type text,
  p_reason text,
  p_fingerprint_hash text,
  p_device_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_id uuid;
  v_inserted_id uuid;
  v_window_interval interval;
  v_lock_key text;
begin
  -- Validate slug (must be 'arac')
  if p_slug is null or p_slug <> 'arac' then
    return jsonb_build_object('allowed', false, 'error', 'Invalid vehicle slug');
  end if;

  -- Validate event type (only 'scan' and 'scenario' allowed)
  if p_event_type is null or p_event_type not in ('scan', 'scenario') then
    return jsonb_build_object('allowed', false, 'error', 'Invalid event type');
  end if;

  -- Reject null, empty, or whitespace fingerprint
  if p_fingerprint_hash is null or length(trim(p_fingerprint_hash)) = 0 then
    return jsonb_build_object('allowed', false, 'error', 'Missing fingerprint hash');
  end if;

  -- Validate scenario reason if event_type = 'scenario'
  if p_event_type = 'scenario' and (p_reason is null or length(trim(p_reason)) = 0) then
    return jsonb_build_object('allowed', false, 'error', 'Missing scenario reason');
  end if;

  -- 1. Transaction-scoped advisory lock to eliminate race conditions completely
  v_lock_key := p_slug || ':' || p_fingerprint_hash || ':' || p_event_type || ':' || coalesce(p_reason, '');
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- 2. Determine dedup window
  if p_event_type = 'scan' then
    v_window_interval := interval '5 minutes';
  else
    v_window_interval := interval '60 seconds';
  end if;

  -- 3. Check for recent event within window
  if p_event_type = 'scan' then
    select id into v_recent_id
    from public.vehicle_events
    where vehicle_slug = p_slug
      and fingerprint_hash = p_fingerprint_hash
      and event_type = 'scan'
      and created_at >= (now() - v_window_interval)
    limit 1;
  else
    select id into v_recent_id
    from public.vehicle_events
    where vehicle_slug = p_slug
      and fingerprint_hash = p_fingerprint_hash
      and event_type = 'scenario'
      and reason = p_reason
      and created_at >= (now() - v_window_interval)
    limit 1;
  end if;

  -- If duplicate found within window, return deduplicated immediately
  if v_recent_id is not null then
    return jsonb_build_object('allowed', false, 'deduplicated', true);
  end if;

  -- 4. Atomically insert event
  insert into public.vehicle_events (
    vehicle_slug,
    event_type,
    reason,
    fingerprint_hash,
    device_label
  ) values (
    p_slug,
    p_event_type,
    case when p_event_type = 'scenario' then p_reason else null end,
    p_fingerprint_hash,
    coalesce(nullif(trim(p_device_label), ''), 'Bilinmiyor')
  ) returning id into v_inserted_id;

  return jsonb_build_object('allowed', true, 'deduplicated', false, 'event_id', v_inserted_id);
end;
$$;

-- Security & Permissions (strictly service_role only)
revoke all on function public.log_vehicle_event_if_not_deduped(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_vehicle_event_if_not_deduped(text, text, text, text, text) to service_role;

-- Notify PostgREST to reload schema cache immediately
notify pgrst, 'reload schema';
