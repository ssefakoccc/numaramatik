import crypto from "crypto";
import { getAdminServerClient } from "../lib/supabase/admin-server.js";
import { isValidSlug, normalizeSlug } from "../lib/slug.js";
import { hashActivationToken } from "../lib/security/activation.js";

function parseArgs() {
  const args = process.argv.slice(2);
  let name = "Araç";
  let customSlug = null;
  let days = 30;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (arg.startsWith("--name=")) {
      name = arg.slice(7);
    } else if (arg === "--slug" && args[i + 1]) {
      customSlug = args[++i];
    } else if (arg.startsWith("--slug=")) {
      customSlug = arg.slice(7);
    } else if (arg === "--days" && args[i + 1]) {
      days = parseInt(args[++i], 10) || 30;
    } else if (!arg.startsWith("-") && name === "Araç") {
      name = arg;
    }
  }

  return { name: name.trim(), customSlug, days };
}

function generateSecureSlug() {
  // Generates unguessable card ID: 'card-' + 8 random lowercase alphanumeric chars
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(8);
  let result = "card-";
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

async function main() {
  const { name, customSlug, days } = parseArgs();

  const supabase = getAdminServerClient();
  if (!supabase) {
    console.error("❌ HATA: Supabase admin servisine bağlanılamadı. .env.local dosyasındaki SUPABASE_SERVICE_ROLE_KEY değerini kontrol edin.");
    process.exit(1);
  }

  let slug = customSlug ? normalizeSlug(customSlug) : generateSecureSlug();
  if (!slug || !isValidSlug(slug)) {
    console.error("❌ HATA: Geçersiz slug formatı. Yalnızca küçük harf, rakam ve tek tire kullanılabilir.");
    process.exit(1);
  }

  // 0. Check if Phase 1 migration has been applied
  const { error: phase1Err } = await supabase.from("vehicle_card").select("is_activated").limit(1);
  if (phase1Err) {
    console.error("\n⚠️  HATA: Supabase Phase 1 migration henüz uygulanmamış!");
    console.error("Lütfen önce 'supabase-sprint-4-phase-1.sql' dosyasını Supabase SQL Editöründe çalıştırın.\n");
    process.exit(1);
  }

  // 1. Check if slug already exists (DO NOT overwrite!)
  const { data: existing, error: checkErr } = await supabase
    .from("vehicle_card")
    .select("slug")
    .eq("slug", slug)
    .single();

  if (!checkErr && existing) {
    console.error(`❌ HATA: '${slug}' slugı zaten mevcut! Var olan kartların üzerine yazılamaz.`);
    process.exit(1);
  }

  // 2. Insert new unactivated card with NULL phone number
  const { error: insertErr } = await supabase.from("vehicle_card").insert({
    slug,
    display_name: name,
    is_activated: false,
    phone_number: null,
  });

  if (insertErr) {
    console.error("❌ HATA: Araç kartı veritabanına kaydedilemedi:", insertErr.message);
    process.exit(1);
  }

  // 3. Generate raw activation token & store ONLY SHA-256 hash
  const rawToken = crypto.randomBytes(16).toString("hex");
  const tokenHash = hashActivationToken(rawToken);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenErr } = await supabase.from("card_activation_tokens").insert({
    vehicle_slug: slug,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (tokenErr) {
    console.error("❌ HATA: Aktivasyon tokenı kaydedilemedi:", tokenErr.message);
    // Cleanup the unactivated card to keep DB clean
    await supabase.from("vehicle_card").delete().eq("slug", slug);
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://numaratik.vercel.app";
  const qrUrl = `${baseUrl}/c/${slug}`;
  const activationUrl = `${baseUrl}/activate/${rawToken}`;

  console.log("\n=======================================================");
  console.log("🚗 NUMARATİK YENİ FİZİKSEL ARAÇ KARTI OLUŞTURULDU");
  console.log("=======================================================");
  console.log(`Kart Adı:           ${name}`);
  console.log(`Kart Slug:          ${slug}`);
  console.log(`Durum:              Kurulmamış (is_activated: false)`);
  console.log(`Telefon:            Tanımlanmamış (Aktivasyonda girilecek)`);
  console.log("-------------------------------------------------------");
  console.log(`QR Hedef Adresi:    ${qrUrl}`);
  console.log(`Aktivasyon Linki:   ${activationUrl}`);
  console.log(`Son Geçerlilik:     ${expiresAt} (${days} gün)`);
  console.log("-------------------------------------------------------");
  console.log("⚠️  GÜVENLİK BİLGİSİ:");
  console.log("Ham aktivasyon linki yalnızca ŞİMDİ gösterilmiştir.");
  console.log("Veritabanında yalnızca tek yönlü SHA-256 hash saklanır.");
  console.log("Bu aktivasyon linkini kart sahibine güvenle iletiniz.");
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
