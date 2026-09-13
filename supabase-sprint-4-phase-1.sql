-- Numaratik Sprint 4 - Aşama 1 (Phase 1): Canlıya Uyumlu ve Geriye Dönük Güvenli Migration
-- Bu dosya YALNIZCA additive (eklemeli) değişiklikler içerir.
-- Mevcut çalışan 'arac' kartının canlı okuma yetkilerini (anon select) BOZMAZ.
-- İdempotenttir, mükerrer çalıştırıldığında veri kaybına yol açmaz.
--
-- GÜVENLİK İLKESİ:
-- public.vehicle_card tablosunda parola, salt, bot token veya chat ID GİBİ HİÇBİR HASSAS VERİ TUTULMAZ.
-- Tüm kimlik ve token verileri Row Level Security (RLS) aktif, anon'a kapalı private tablolarda saklanır.

-- 1. vehicle_card tablosuna yeni genel kolonlar ekle
alter table public.vehicle_card
  add column if not exists display_name text not null default 'Araç',
  add column if not exists is_activated boolean not null default false;

-- Yeni kurulmamış kartlar için telefon numarasının boş (null) olabilmesine izin ver
alter table public.vehicle_card alter column phone_number drop not null;

-- Mevcut 'arac' kartını aktif ve varsayılan isimle işaretle
update public.vehicle_card
set display_name = 'Araç',
    is_activated = true
where slug = 'arac';

-- DİKKAT: Phase 1'de vehicle_card üzerindeki mevcut anon select yetkisi KORUNUR!
-- Böylece şu anda canlıda çalışan /api/phone endpointi kesintisiz çalışmaya devam eder.
grant select on table public.vehicle_card to anon, authenticated;
grant all on table public.vehicle_card to service_role;

-- 2. Kart Admin Giriş Kimlik Tablosu (Private)
-- Parola hash ve salt bilgileri public vehicle_card tablosundan tamamen izoledir!
create table if not exists public.vehicle_card_admin_credentials (
  vehicle_slug text primary key references public.vehicle_card(slug) on delete cascade,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Aktif Telegram Bot Kimlik Tablosu (Private)
create table if not exists public.vehicle_telegram_credentials (
  vehicle_slug text primary key references public.vehicle_card(slug) on delete cascade,
  bot_id text not null unique,
  bot_username text not null,
  bot_token_ciphertext text not null,
  bot_token_iv text not null,
  bot_token_auth_tag text not null,
  telegram_chat_id text null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Bekleyen (Pending) Telegram Bot Tablosu (Private)
-- Yeni bot bağlanırken eski çalışan botun hemen ezilmesini önler
create table if not exists public.vehicle_telegram_credentials_pending (
  vehicle_slug text primary key references public.vehicle_card(slug) on delete cascade,
  bot_id text not null,
  bot_username text not null,
  bot_token_ciphertext text not null,
  bot_token_iv text not null,
  bot_token_auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Tek Kullanımlık Kart Aktivasyon Tokenları (Private)
create table if not exists public.card_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  vehicle_slug text not null references public.vehicle_card(slug) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 6. Tek Kullanımlık Telegram Eşleştirme Tokenları (Private)
create table if not exists public.card_telegram_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  vehicle_slug text not null references public.vehicle_card(slug) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

-- Hızlı arama indeksleri
create index if not exists idx_activation_token_hash on public.card_activation_tokens (token_hash) where used_at is null;
create index if not exists idx_pairing_token_hash on public.card_telegram_pairing_tokens (token_hash) where used_at is null;

-- Tüm private tablolarda RLS'i etkinleştir ve anon/authenticated erişimini tamamen kapat
alter table public.vehicle_card_admin_credentials enable row level security;
alter table public.vehicle_telegram_credentials enable row level security;
alter table public.vehicle_telegram_credentials_pending enable row level security;
alter table public.card_activation_tokens enable row level security;
alter table public.card_telegram_pairing_tokens enable row level security;

revoke all on table public.vehicle_card_admin_credentials from public, anon, authenticated;
revoke all on table public.vehicle_telegram_credentials from public, anon, authenticated;
revoke all on table public.vehicle_telegram_credentials_pending from public, anon, authenticated;
revoke all on table public.card_activation_tokens from public, anon, authenticated;
revoke all on table public.card_telegram_pairing_tokens from public, anon, authenticated;

grant all on table public.vehicle_card_admin_credentials to service_role;
grant all on table public.vehicle_telegram_credentials to service_role;
grant all on table public.vehicle_telegram_credentials_pending to service_role;
grant all on table public.card_activation_tokens to service_role;
grant all on table public.card_telegram_pairing_tokens to service_role;

-- 7. Atomik Kart Aktivasyon RPC
create or replace function public.activate_vehicle_card(
  p_token_hash text,
  p_phone_number text,
  p_display_name text,
  p_password_hash text,
  p_password_salt text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_id uuid;
  v_slug text;
  v_used_at timestamptz;
  v_expires_at timestamptz;
  v_is_activated boolean;
begin
  -- 1. Aktivasyon token satırını kilitle (FOR UPDATE)
  select id, vehicle_slug, used_at, expires_at
  into v_token_id, v_slug, v_used_at, v_expires_at
  from public.card_activation_tokens
  where token_hash = p_token_hash
  for update;

  if v_token_id is null then
    return jsonb_build_object('success', false, 'error', 'Geçersiz aktivasyon bağlantısı.');
  end if;

  if v_used_at is not null then
    return jsonb_build_object('success', false, 'error', 'Bu aktivasyon bağlantısı daha önce kullanılmış.');
  end if;

  if v_expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Aktivasyon bağlantısının süresi dolmuş.');
  end if;

  -- 2. İlgili araç kartı satırını kilitle (FOR UPDATE)
  select is_activated
  into v_is_activated
  from public.vehicle_card
  where slug = v_slug
  for update;

  if v_is_activated is null then
    return jsonb_build_object('success', false, 'error', 'Araç kartı bulunamadı.');
  end if;

  if v_is_activated = true then
    update public.card_activation_tokens set used_at = now() where id = v_token_id;
    return jsonb_build_object('success', false, 'error', 'Bu araç kartı zaten aktif edilmiştir.');
  end if;

  -- 3. Kart bilgilerini güncelle (şifre bilgisi buraya yazılmaz!)
  update public.vehicle_card
  set phone_number = p_phone_number,
      display_name = coalesce(nullif(trim(p_display_name), ''), 'Araç'),
      is_activated = true
  where slug = v_slug;

  -- 4. Parola hash ve salt bilgisini private admin kimlik tablosuna kaydet (upsert)
  insert into public.vehicle_card_admin_credentials (
    vehicle_slug,
    password_hash,
    password_salt,
    created_at,
    updated_at
  ) values (
    v_slug,
    p_password_hash,
    p_password_salt,
    now(),
    now()
  )
  on conflict (vehicle_slug) do update set
    password_hash = excluded.password_hash,
    password_salt = excluded.password_salt,
    updated_at = now();

  -- 5. Tokenı kullanıldı olarak işaretle
  update public.card_activation_tokens
  set used_at = now()
  where id = v_token_id;

  return jsonb_build_object('success', true, 'slug', v_slug);
end;
$$;

revoke all on function public.activate_vehicle_card(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.activate_vehicle_card(text, text, text, text, text) to service_role;

-- 8. Atomik Telegram Eşleştirme Tamamlama RPC
create or replace function public.complete_telegram_pairing(
  p_slug text,
  p_pairing_token_hash text,
  p_chat_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_id uuid;
  v_used_at timestamptz;
  v_expires_at timestamptz;
  v_pending record;
begin
  -- 1. Eşleştirme token satırını kilitle (FOR UPDATE)
  select id, used_at, expires_at
  into v_token_id, v_used_at, v_expires_at
  from public.card_telegram_pairing_tokens
  where token_hash = p_pairing_token_hash and vehicle_slug = p_slug
  for update;

  if v_token_id is null then
    return jsonb_build_object('success', false, 'error', 'Geçersiz eşleştirme kodu.');
  end if;

  if v_used_at is not null then
    return jsonb_build_object('success', false, 'error', 'Bu eşleştirme kodu daha önce kullanılmış.');
  end if;

  if v_expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Eşleştirme kodunun süresi dolmuş.');
  end if;

  -- 2. Bekleyen bot kaydını kilitle (FOR UPDATE)
  select *
  into v_pending
  from public.vehicle_telegram_credentials_pending
  where vehicle_slug = p_slug
  for update;

  if v_pending.vehicle_slug is null then
    return jsonb_build_object('success', false, 'error', 'Bu kart için bekleyen bot kaydı bulunamadı.');
  end if;

  -- 3. Aynı botun başka aktif karta bağlı olup olmadığını kontrol et
  if exists (
    select 1 from public.vehicle_telegram_credentials
    where bot_id = v_pending.bot_id and vehicle_slug <> p_slug
  ) then
    return jsonb_build_object('success', false, 'error', 'Bu bot zaten başka bir araç kartına bağlı.');
  end if;

  -- 4. Bekleyen botu aktif kimliklere taşı (upsert)
  insert into public.vehicle_telegram_credentials (
    vehicle_slug,
    bot_id,
    bot_username,
    bot_token_ciphertext,
    bot_token_iv,
    bot_token_auth_tag,
    telegram_chat_id,
    connected_at,
    created_at,
    updated_at
  ) values (
    p_slug,
    v_pending.bot_id,
    v_pending.bot_username,
    v_pending.bot_token_ciphertext,
    v_pending.bot_token_iv,
    v_pending.bot_token_auth_tag,
    p_chat_id,
    now(),
    now(),
    now()
  )
  on conflict (vehicle_slug) do update set
    bot_id = excluded.bot_id,
    bot_username = excluded.bot_username,
    bot_token_ciphertext = excluded.bot_token_ciphertext,
    bot_token_iv = excluded.bot_token_iv,
    bot_token_auth_tag = excluded.bot_token_auth_tag,
    telegram_chat_id = excluded.telegram_chat_id,
    connected_at = now(),
    updated_at = now();

  -- 5. Bekleyen kaydı sil
  delete from public.vehicle_telegram_credentials_pending where vehicle_slug = p_slug;

  -- 6. Eşleştirme tokenını kullanıldı olarak işaretle
  update public.card_telegram_pairing_tokens
  set used_at = now()
  where id = v_token_id;

  return jsonb_build_object('success', true, 'bot_username', v_pending.bot_username);
end;
$$;

revoke all on function public.complete_telegram_pairing(text, text, text) from public, anon, authenticated;
grant execute on function public.complete_telegram_pairing(text, text, text) to service_role;

-- 9. Kart Kapsamlı ve Aktiflik Kontrollü Atomic Dedup RPC
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
set search_path = public, pg_temp
as $$
declare
  v_recent_id uuid;
  v_inserted_id uuid;
  v_window_interval interval;
  v_lock_key text;
  v_is_activated boolean;
begin
  -- Slug biçim doğrulaması
  if p_slug is null or length(p_slug) > 50 or not (p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
    return jsonb_build_object('allowed', false, 'error', 'Invalid vehicle slug format');
  end if;

  -- Kart varlığı ve aktiflik kontrolü
  select is_activated into v_is_activated
  from public.vehicle_card
  where slug = p_slug;

  if v_is_activated is null then
    return jsonb_build_object('allowed', false, 'error', 'Vehicle card not found');
  end if;

  if v_is_activated = false then
    return jsonb_build_object('allowed', false, 'error', 'Vehicle card is not activated');
  end if;

  -- Olay türü kontrolü
  if p_event_type is null or p_event_type not in ('scan', 'scenario') then
    return jsonb_build_object('allowed', false, 'error', 'Invalid event type');
  end if;

  -- Fingerprint kontrolü
  if p_fingerprint_hash is null or length(trim(p_fingerprint_hash)) = 0 then
    return jsonb_build_object('allowed', false, 'error', 'Missing fingerprint hash');
  end if;

  -- Senaryo sebep kontrolü
  if p_event_type = 'scenario' and (p_reason is null or length(trim(p_reason)) = 0) then
    return jsonb_build_object('allowed', false, 'error', 'Missing scenario reason');
  end if;

  -- Kart ve parmakizi bazlı transaction kilit
  v_lock_key := p_slug || ':' || p_fingerprint_hash || ':' || p_event_type || ':' || coalesce(p_reason, '');
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- Dedup pencere aralığı
  if p_event_type = 'scan' then
    v_window_interval := interval '5 minutes';
  else
    v_window_interval := interval '60 seconds';
  end if;

  -- Kart kapsamında mükerrer kontrolü
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

  if v_recent_id is not null then
    return jsonb_build_object('allowed', false, 'deduplicated', true);
  end if;

  -- Olay kaydı oluştur
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

revoke all on function public.log_vehicle_event_if_not_deduped(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_vehicle_event_if_not_deduped(text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
