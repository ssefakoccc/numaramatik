-- Numaratik Sprint 4 - Aşama 2 (Phase 2): Lockdown Migration
-- DİKKAT: Bu script YALNIZCA yeni Sprint 4 kodu Vercel Production'a deploy edilip
-- canlıda başarıyla doğrulandıktan sonra çalıştırılmalıdır!
--
-- Yeni kodda /api/phone endpointi doğrudan service_role ile sorgu attığı için,
-- vehicle_card tablosu üzerindeki anon okuma yetkisi tamamen kaldırılarak parola tuzları
-- ve hashleri dış dünyaya kapatılır.

-- 1. vehicle_card tablosundan public/anon/authenticated yetkilerini tamamen kaldır
revoke all on table public.vehicle_card from public, anon, authenticated;

-- 2. Yalnızca service_role için tam yetki ver
grant all on table public.vehicle_card to service_role;

-- 3. PostgREST şema önbelleğini tazele
notify pgrst, 'reload schema';

-- ROLLBACK TALİMATI:
-- Eğer eski deployment'a (Sprint 3.1) geri dönülmesi (rollback) gerekirse,
-- aşağıdaki tek satırlık komut Supabase SQL editöründe çalıştırılarak anon select geri açılabilir:
-- grant select on table public.vehicle_card to anon, authenticated;
