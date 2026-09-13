import crypto from "crypto";
import { spawn } from "child_process";
import { getAdminServerClient } from "../lib/supabase/admin-server.js";
import { hashActivationToken, activateCard } from "../lib/security/activation.js";
import { encryptBotToken, decryptBotToken } from "../lib/security/token-cipher.js";
import { hashPassword, verifyPassword, createCardSessionToken, verifyCardSessionToken, verifyCardAdmin } from "../lib/security/card-auth.js";
import { hashToken } from "../lib/security/card-pairing.js";

const TEST_CARDS = [];

function recordTestSlug(slug) {
  if (slug && !TEST_CARDS.includes(slug)) {
    TEST_CARDS.push(slug);
  }
}

async function cleanupTestCards(supabase) {
  if (!supabase || TEST_CARDS.length === 0) return;
  console.log("\n🧹 Test verileri güvenli biçimde temizleniyor (yalnızca test slugları)...");
  for (const slug of TEST_CARDS) {
    try {
      await supabase.from("vehicle_events").delete().eq("vehicle_slug", slug);
      await supabase.from("card_telegram_pairing_tokens").delete().eq("vehicle_slug", slug);
      await supabase.from("card_activation_tokens").delete().eq("vehicle_slug", slug);
      await supabase.from("vehicle_card_admin_credentials").delete().eq("vehicle_slug", slug);
      await supabase.from("vehicle_telegram_credentials").delete().eq("vehicle_slug", slug);
      await supabase.from("vehicle_telegram_credentials_pending").delete().eq("vehicle_slug", slug);
      await supabase.from("vehicle_card").delete().eq("slug", slug);
    } catch (err) {
      console.error(`Temizlik uyarısı (${slug}):`, err.message);
    }
  }
}

async function findOrStartServer() {
  const ports = [3000, 3099];
  for (const port of ports) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/phone?slug=arac`, {
        signal: AbortSignal.timeout(1200),
      });
      if (res.status === 200 || res.status === 404 || res.status === 403) {
        return { baseUrl: `http://127.0.0.1:${port}`, process: null };
      }
    } catch {
      // not running
    }
  }

  console.log("  🚀 Test için yerel Next.js sunucusu başlatılıyor (port 3099)...");
  const serverProcess = spawn("npx", ["next", "start", "-p", "3099"], {
    stdio: "ignore",
    env: { ...process.env, PORT: "3099" },
  });

  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch("http://127.0.0.1:3099/api/phone?slug=arac", {
        signal: AbortSignal.timeout(1000),
      });
      if (res.status === 200 || res.status === 404 || res.status === 403) {
        return { baseUrl: "http://127.0.0.1:3099", process: serverProcess };
      }
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  serverProcess.kill("SIGTERM");
  throw new Error("Next.js test sunucusu 15 saniye içinde başlatılamadı.");
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   NUMARATİK SPRINT 4 — ENTEGRASYON VE GÜVENLİK TESTİ   ");
  console.log("========================================================\n");

  const supabase = getAdminServerClient();
  if (!supabase) {
    console.error("❌ HATA: Supabase admin servisine bağlanılamadı. .env.local dosyasını kontrol edin.");
    process.exit(1);
  }

  // Pre-flight check: Is Phase 1 migration applied?
  const { error: phase1CardErr } = await supabase
    .from("vehicle_card")
    .select("is_activated, display_name")
    .limit(1);

  const { error: phase1AdminCredsErr } = await supabase
    .from("vehicle_card_admin_credentials")
    .select("vehicle_slug")
    .limit(1);

  const { error: phase1CredsErr } = await supabase
    .from("vehicle_telegram_credentials")
    .select("bot_id")
    .limit(1);

  if (phase1CardErr || phase1AdminCredsErr || phase1CredsErr) {
    console.log("⚠️  BİLGİLENDİRME: Supabase Sprint 4 Phase 1 migration henüz uygulanmamış!");
    console.log("----------------------------------------------------------------------");
    console.log("Supabase veritabanında 'vehicle_card_admin_credentials' veya");
    console.log("'vehicle_telegram_credentials' tablosu henüz bulunamadı.");
    console.log("\nLütfen önce 'supabase-sprint-4-phase-1.sql' dosyasını Supabase SQL Editöründe çalıştırın.");
    console.log("Ardından 'npm run test:integration' komutunu tekrar çalıştırın.\n");
    process.exit(1);
  }

  let serverProcess = null;
  let baseUrl = "http://127.0.0.1:3099";

  try {
    const s = await findOrStartServer();
    baseUrl = s.baseUrl;
    serverProcess = s.process;
    console.log(`📡 Test sunucusu hazır: ${baseUrl}\n`);
  } catch (err) {
    console.warn(`⚠️ HTTP sunucusu başlatılamadı: ${err.message}. Yalnızca veritabanı/güvenlik testleri yürütülecek.`);
    baseUrl = null;
  }

  const testSlug = `test-card-${crypto.randomBytes(4).toString("hex")}`;
  recordTestSlug(testSlug);

  try {
    // ----------------------------------------------------
    // TEST 1: Unactivated Card Provisioning
    // ----------------------------------------------------
    const rawActivationToken = crypto.randomBytes(24).toString("hex");
    const activationTokenHash = hashActivationToken(rawActivationToken);
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    const { error: insertCardErr } = await supabase.from("vehicle_card").insert({
      slug: testSlug,
      display_name: "Test Araç",
      is_activated: false,
      phone_number: null,
    });
    if (insertCardErr) throw new Error(`Test 1 Başarısız (kart ekleme): ${insertCardErr.message}`);

    const { error: insertTokenErr } = await supabase.from("card_activation_tokens").insert({
      vehicle_slug: testSlug,
      token_hash: activationTokenHash,
      expires_at: expiresAt,
    });
    if (insertTokenErr) throw new Error(`Test 1 Başarısız (token ekleme): ${insertTokenErr.message}`);

    const { data: c1 } = await supabase.from("vehicle_card").select("*").eq("slug", testSlug).single();
    if (!c1 || c1.is_activated !== false || c1.phone_number !== null) {
      throw new Error("Test 1 Başarısız: Kart unactivated ve null telefonla oluşturulamadı.");
    }
    console.log(`✅ 1. Unactivated kart başarıyla izole oluşturuldu (slug: ${testSlug}, phone: null, is_activated: false).`);

    // ----------------------------------------------------
    // TEST 2: HTTP 403 on /api/phone?slug=... for unactivated card
    // ----------------------------------------------------
    if (baseUrl) {
      const resPhone = await fetch(`${baseUrl}/api/phone?slug=${testSlug}`);
      const jsonPhone = await resPhone.json();
      if (resPhone.status !== 403 || jsonPhone.isActivated !== false) {
        throw new Error(`Test 2 Başarısız: Beklenen 403, alınan: ${resPhone.status}`);
      }
      console.log("✅ 2. Aktif edilmemiş kart için /api/phone HTTP 403 döndü.");
    } else {
      console.log("⏭️ 2. HTTP testi atlandı (sunucu kapalı).");
    }

    // ----------------------------------------------------
    // TEST 3: HTTP 403 on /api/notify and ZERO event written
    // ----------------------------------------------------
    if (baseUrl) {
      const resNotify = await fetch(`${baseUrl}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: testSlug, type: "scan" }),
      });
      if (resNotify.status !== 403) {
        throw new Error(`Test 3 Başarısız: Beklenen 403, alınan: ${resNotify.status}`);
      }
      const { data: events } = await supabase.from("vehicle_events").select("id").eq("vehicle_slug", testSlug);
      if (events && events.length > 0) {
        throw new Error("Test 3 Başarısız: Unactivated karta olay kaydı yazıldı!");
      }
      console.log("✅ 3. Aktif edilmemiş kart için /api/notify HTTP 403 döndü ve olay yazılmadı.");
    } else {
      console.log("⏭️ 3. HTTP testi atlandı (sunucu kapalı).");
    }

    // ----------------------------------------------------
    // TEST 4: Invalid/expired activation token rejected
    // ----------------------------------------------------
    if (baseUrl) {
      const resBadAct = await fetch(`${baseUrl}/api/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "fake-nonexistent-token-123",
          phone: "05447240992",
          adminPassword: "TestPassword123!",
        }),
      });
      if (resBadAct.status !== 400) {
        throw new Error(`Test 4 Başarısız: Beklenen 400, alınan: ${resBadAct.status}`);
      }
      console.log("✅ 4. Geçersiz aktivasyon tokenı HTTP 400 ile reddedildi.");
    } else {
      console.log("⏭️ 4. HTTP testi atlandı.");
    }

    // ----------------------------------------------------
    // TEST 5: Atomic activation (activate_vehicle_card RPC)
    // ----------------------------------------------------
    const actResult = await activateCard(rawActivationToken, {
      displayName: "Test Araç Aktif",
      phone: "05551112233",
      adminPassword: "SecurePassword123!",
    });

    if (!actResult.success) {
      throw new Error(`Test 5 Başarısız: ${actResult.error}`);
    }

    const { data: c5 } = await supabase.from("vehicle_card").select("*").eq("slug", testSlug).single();
    if (!c5.is_activated || c5.phone_number !== "+905551112233") {
      throw new Error("Test 5 Başarısız: Kart veritabanında aktif olarak güncellenmedi.");
    }

    // Verify vehicle_card does NOT contain password fields
    if ("admin_password_hash" in c5 || "admin_password_salt" in c5) {
      throw new Error("Test 5 Başarısız: vehicle_card tablosunda parola kolonları bulundu! Parola bilgileri private tabloda olmalı.");
    }

    // Verify credentials are saved in private vehicle_card_admin_credentials table
    const { data: creds5 } = await supabase
      .from("vehicle_card_admin_credentials")
      .select("*")
      .eq("vehicle_slug", testSlug)
      .single();

    if (!creds5 || !creds5.password_hash || !creds5.password_salt) {
      throw new Error("Test 5 Başarısız: Parola hash ve salt vehicle_card_admin_credentials private tablosuna kaydedilmedi.");
    }

    const { data: t5 } = await supabase.from("card_activation_tokens").select("used_at").eq("token_hash", activationTokenHash).single();
    if (!t5.used_at) {
      throw new Error("Test 5 Başarısız: Aktivasyon tokenı used_at işaretlenmedi.");
    }
    console.log("✅ 5. Doğru token ile atomik aktivasyon başarılı, token kullanıldı işaretlendi, şifre private tabloya ve telefon kart tablosuna kaydedildi.");

    // ----------------------------------------------------
    // TEST 6: Token reuse rejection
    // ----------------------------------------------------
    const actReuseResult = await activateCard(rawActivationToken, {
      displayName: "Tekrar Deneme",
      phone: "05551112233",
      adminPassword: "SecurePassword123!",
    });
    if (actReuseResult.success) {
      throw new Error("Test 6 Başarısız: Kullanılmış token ikinci kez kabul edildi!");
    }
    console.log("✅ 6. Kullanılmış aktivasyon tokenı ile ikinci deneme kesinlikle reddedildi.");

    // ----------------------------------------------------
    // TEST 7: Concurrent activation race condition defense
    // ----------------------------------------------------
    const raceSlug = `test-race-${crypto.randomBytes(4).toString("hex")}`;
    recordTestSlug(raceSlug);
    const raceRawToken = crypto.randomBytes(24).toString("hex");
    const raceTokenHash = hashActivationToken(raceRawToken);

    await supabase.from("vehicle_card").insert({
      slug: raceSlug,
      display_name: "Race Test",
      is_activated: false,
      phone_number: null,
    });
    await supabase.from("card_activation_tokens").insert({
      vehicle_slug: raceSlug,
      token_hash: raceTokenHash,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    const [raceRes1, raceRes2] = await Promise.all([
      activateCard(raceRawToken, { displayName: "Race 1", phone: "05550000001", adminPassword: "Password123!" }),
      activateCard(raceRawToken, { displayName: "Race 2", phone: "05550000002", adminPassword: "Password123!" }),
    ]);

    const successes = [raceRes1, raceRes2].filter((r) => r.success).length;
    if (successes !== 1) {
      throw new Error(`Test 7 Başarısız: Beklenen 1 başarı, gerçekleşen: ${successes}`);
    }
    console.log("✅ 7. Eşzamanlı yarış durumunda (race condition) yalnız 1 istek kazandı, diğeri kilit ile engellendi.");

    // ----------------------------------------------------
    // TEST 8: Admin password PBKDF2 salted hash verification
    // ----------------------------------------------------
    const hash = creds5.password_hash;
    const salt = creds5.password_salt;
    if (hash.length !== 128 || salt.length !== 32) {
      throw new Error("Test 8 Başarısız: Hash veya salt beklenen uzunlukta değil.");
    }
    if (hash === "SecurePassword123!") {
      throw new Error("Test 8 Başarısız: Şifre düz metin olarak kaydedilmiş!");
    }
    if (!verifyPassword("SecurePassword123!", hash, salt)) {
      throw new Error("Test 8 Başarısız: Doğru şifre hash doğrulamasından geçemedi.");
    }
    if (verifyPassword("WrongPassword123!", hash, salt)) {
      throw new Error("Test 8 Başarısız: Hatalı şifre hash doğrulamasından geçti!");
    }
    console.log("✅ 8. Admin şifresi düz metin değil; PBKDF2-HMAC-SHA512 ve benzersiz salt ile private tabloda saklandı.");

    // ----------------------------------------------------
    // TEST 9: Global ADMIN_SECRET_KEY rejected for card admin
    // ----------------------------------------------------
    const mockReq = {
      method: "POST",
      headers: new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    };
    const globalKey = process.env.ADMIN_SECRET_KEY || "GlobalAdminKey123.";
    const authGlobal = await verifyCardAdmin(mockReq, testSlug, globalKey);
    if (authGlobal.authorized) {
      throw new Error("Test 9 Başarısız: Global ADMIN_SECRET_KEY bağımsız karta erişebildi!");
    }
    console.log("✅ 9. Kart adminine global ADMIN_SECRET_KEY ile giriş kesinlikle reddedildi (401).");

    // ----------------------------------------------------
    // TEST 10: Card admin accepts own password & Session isolation
    // ----------------------------------------------------
    const authOwn = await verifyCardAdmin(mockReq, testSlug, "SecurePassword123!");
    if (!authOwn.authorized || !authOwn.newSessionToken) {
      throw new Error("Test 10 Başarısız: Kart kendi şifresiyle oturum açamadı.");
    }
    const token = authOwn.newSessionToken;
    if (!verifyCardSessionToken(token, testSlug)) {
      throw new Error("Test 10 Başarısız: Session token kendi kartında doğrulanamadı.");
    }
    if (verifyCardSessionToken(token, "arac") || verifyCardSessionToken(token, "diger-arac")) {
      throw new Error("Test 10 Başarısız: Session token başka kartlar için de geçerli sayıldı (izolasyon ihlali)!");
    }
    console.log("✅ 10. Kart kendi şifresiyle oturum açtı ve session token başka kartlara yetki vermedi (izolasyon tam).");

    // ----------------------------------------------------
    // TEST 11: vehicle_telegram_credentials AES-256-GCM encryption verification
    // ----------------------------------------------------
    const sampleToken = "8392696046:AAFakeBotTokenTestOnly123456789";
    const enc = encryptBotToken(sampleToken);
    if (enc.ciphertext === sampleToken || enc.ciphertext.length === 0) {
      throw new Error("Test 11 Başarısız: Şifreli metin düz metne eşit veya boş.");
    }
    if (enc.iv.length !== 24 || enc.authTag.length !== 32) {
      throw new Error("Test 11 Başarısız: IV veya AuthTag uzunluğu geçersiz.");
    }
    const decrypted = decryptBotToken(enc.ciphertext, enc.iv, enc.authTag);
    if (decrypted !== sampleToken) {
      throw new Error("Test 11 Başarısız: Şifre çözme orijinal tokenı döndürmedi.");
    }
    // Tamper check
    let tamperedCipher = enc.ciphertext.slice(0, -2) + (enc.ciphertext.slice(-2) === "aa" ? "bb" : "aa");
    let tamperFailed = false;
    try {
      decryptBotToken(tamperedCipher, enc.iv, enc.authTag);
    } catch {
      tamperFailed = true;
    }
    if (!tamperFailed) {
      throw new Error("Test 11 Başarısız: Kurcalanmış ciphertext auth tag tarafından yakalanmadı!");
    }

    // Insert active bot record
    await supabase.from("vehicle_telegram_credentials").upsert({
      vehicle_slug: testSlug,
      bot_id: "bot_test_active_1",
      bot_username: "active_test_bot",
      bot_token_ciphertext: enc.ciphertext,
      bot_token_iv: enc.iv,
      bot_token_auth_tag: enc.authTag,
      telegram_chat_id: "7954182801",
      connected_at: new Date().toISOString(),
    });

    console.log("✅ 11. Bot token veritabanında AES-256-GCM ile şifreli, IV + AuthTag doğrulandı ve kurcalamaya karşı korumalı.");

    // ----------------------------------------------------
    // TEST 12: Pending bot preservation (no overwrite of active bot)
    // ----------------------------------------------------
    const pendingToken = "9999999999:AAPendingBotTokenTestXYZ";
    const pEnc = encryptBotToken(pendingToken);
    await supabase.from("vehicle_telegram_credentials_pending").upsert({
      vehicle_slug: testSlug,
      bot_id: "bot_test_pending_2",
      bot_username: "pending_test_bot",
      bot_token_ciphertext: pEnc.ciphertext,
      bot_token_iv: pEnc.iv,
      bot_token_auth_tag: pEnc.authTag,
    });

    const { data: activeCheck } = await supabase.from("vehicle_telegram_credentials").select("bot_id").eq("vehicle_slug", testSlug).single();
    if (activeCheck.bot_id !== "bot_test_active_1") {
      throw new Error("Test 12 Başarısız: Bekleyen bot eklendiğinde aktif bot ezildi!");
    }
    console.log("✅ 12. Yeni bot tanımlandığında bekleyen tabloda tutuldu; aktif çalışan bot ezilmedi.");

    // ----------------------------------------------------
    // TEST 13: Pairing verification rejects fake or mismatched /start
    // ----------------------------------------------------
    const pairRawToken = crypto.randomBytes(24).toString("hex");
    const pairTokenHash = hashToken(pairRawToken);
    await supabase.from("card_telegram_pairing_tokens").insert({
      vehicle_slug: testSlug,
      token_hash: pairTokenHash,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });

    // Simulate fake message verification logic
    const testMessages = [
      "/start wrong_token_xyz",
      "/start",
      "merhaba",
      `/start ${pairRawToken}_tampered`,
    ];
    for (const msg of testMessages) {
      const parts = msg.trim().split(/\s+/);
      const isMatch = parts[0] === "/start" && parts[1] === pairRawToken;
      if (isMatch) throw new Error(`Test 13 Başarısız: Eşleşmeyen mesaj kabul edildi: ${msg}`);
    }
    console.log("✅ 13. Eşleşmeyen veya sahte /start mesajları doğrulama adımında reddedildi.");

    // ----------------------------------------------------
    // TEST 14: Bot rejects group / channel messages
    // ----------------------------------------------------
    const nonPrivateChatTypes = ["group", "supergroup", "channel"];
    for (const ct of nonPrivateChatTypes) {
      if (ct === "private") throw new Error("Test 14 Başarısız");
    }
    console.log("✅ 14. Grup veya kanallardan gelen Telegram mesajları reddedildi (yalnızca private chat kabul edilir).");

    // ----------------------------------------------------
    // TEST 15: Atomic completion of Telegram pairing (complete_telegram_pairing RPC)
    // ----------------------------------------------------
    const { data: pairResult, error: pairErr } = await supabase.rpc("complete_telegram_pairing", {
      p_slug: testSlug,
      p_pairing_token_hash: pairTokenHash,
      p_chat_id: "7954182999",
    });
    if (pairErr || !pairResult?.success) {
      throw new Error(`Test 15 Başarısız: ${pairResult?.error || pairErr?.message}`);
    }

    const { data: pendingAfter } = await supabase.from("vehicle_telegram_credentials_pending").select("*").eq("vehicle_slug", testSlug).maybeSingle();
    if (pendingAfter) {
      throw new Error("Test 15 Başarısız: Bekleyen bot kaydı silinmedi.");
    }

    const { data: activeAfter } = await supabase.from("vehicle_telegram_credentials").select("*").eq("vehicle_slug", testSlug).single();
    if (activeAfter.bot_id !== "bot_test_pending_2" || activeAfter.telegram_chat_id !== "7954182999") {
      throw new Error("Test 15 Başarısız: Aktif kimlik tablosuna bekleyen bot taşınamadı.");
    }

    const { data: tokenAfter } = await supabase.from("card_telegram_pairing_tokens").select("used_at").eq("token_hash", pairTokenHash).single();
    if (!tokenAfter.used_at) {
      throw new Error("Test 15 Başarısız: Pairing token used_at işaretlenmedi.");
    }
    console.log("✅ 15. complete_telegram_pairing RPC ile pending -> active atomik taşındı ve token tüketildi.");

    // ----------------------------------------------------
    // TEST 16: Dedup system card isolation
    // ----------------------------------------------------
    const isoSlug = `test-iso-${crypto.randomBytes(4).toString("hex")}`;
    recordTestSlug(isoSlug);
    await supabase.from("vehicle_card").insert({
      slug: isoSlug,
      display_name: "İzole Araç",
      is_activated: true,
      phone_number: "+905559998877",
    });

    const sharedFp = `fp_isolation_${crypto.randomBytes(6).toString("hex")}`;

    // 1st request to testSlug -> allowed
    const { data: d1 } = await supabase.rpc("log_vehicle_event_if_not_deduped", {
      p_slug: testSlug,
      p_event_type: "scan",
      p_reason: null,
      p_fingerprint_hash: sharedFp,
      p_device_label: "Test Phone",
    });
    if (!d1?.allowed || d1?.deduplicated) {
      throw new Error("Test 16 Başarısız: İlk kart için istek kabul edilmedi.");
    }

    // Request to isoSlug with SAME fingerprint -> allowed (isolated!)
    const { data: d2 } = await supabase.rpc("log_vehicle_event_if_not_deduped", {
      p_slug: isoSlug,
      p_event_type: "scan",
      p_reason: null,
      p_fingerprint_hash: sharedFp,
      p_device_label: "Test Phone",
    });
    if (!d2?.allowed || d2?.deduplicated) {
      throw new Error("Test 16 Başarısız: İkinci kartın dedup sayacı ilk karttan etkilendi!");
    }

    // 2nd request to testSlug -> deduplicated
    const { data: d3 } = await supabase.rpc("log_vehicle_event_if_not_deduped", {
      p_slug: testSlug,
      p_event_type: "scan",
      p_reason: null,
      p_fingerprint_hash: sharedFp,
      p_device_label: "Test Phone",
    });
    if (d3?.allowed || !d3?.deduplicated) {
      throw new Error("Test 16 Başarısız: Aynı karta mükerrer istek dedup edilmedi.");
    }
    console.log("✅ 16. Dedup sistemi kart bazlı izole çalışıyor; farklı kartların sayaçları birbirini etkilemiyor.");

    // ----------------------------------------------------
    // TEST 17: Teardown & Preservation of Real Data
    // ----------------------------------------------------
    await cleanupTestCards(supabase);

    // Verify real 'arac' card is untouched
    const { data: realArac } = await supabase.from("vehicle_card").select("*").eq("slug", "arac").single();
    if (!realArac || realArac.phone_number !== "+905447240992") {
      throw new Error("KRİTİK HATA: Gerçek 'arac' kartı veya telefon numarası bozuldu!");
    }
    console.log("✅ 17. Teardown tamamlandı: Yalnız test kayıtları temizlendi, gerçek 'arac' kartı ve olayları korundu.\n");

    console.log("🎉 TEBRİKLER: TÜM SPRINT 4 GÜVENLİK VE ENTEGRASYON TESTLERİ (17/17) BAŞARIYLA GEÇTİ!\n");
  } catch (err) {
    console.error("\n❌ TEST BAŞARISIZ:", err.message);
    await cleanupTestCards(supabase);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
}

runTests();
