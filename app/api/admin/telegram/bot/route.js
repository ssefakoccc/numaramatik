import { verifyCardAdmin } from "@/lib/security/card-auth";
import { verifyBotToken } from "@/lib/telegram/bot-client";
import { encryptBotToken } from "@/lib/security/token-cipher";
import { createCardPairingToken } from "@/lib/security/card-pairing";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}
    const { slug: rawSlug, secretKey, botToken } = body;

    if (!rawSlug) {
      return Response.json({ success: false, error: "Araç kartı adresi belirtilmedi." }, { status: 400 });
    }
    const slug = normalizeSlug(rawSlug);
    if (!slug) {
      return Response.json({ success: false, error: "Geçersiz araç kartı adresi biçimi." }, { status: 400 });
    }

    const auth = await verifyCardAdmin(req, slug, secretKey);
    if (!auth.authorized) {
      return Response.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let botUsername = null;

    if (!botToken || typeof botToken !== "string" || !botToken.trim()) {
      // Check pending first, then active credentials
      const { data: pendingCreds } = await auth.supabase
        .from("vehicle_telegram_credentials_pending")
        .select("bot_username")
        .eq("vehicle_slug", auth.slug)
        .single();

      if (pendingCreds?.bot_username) {
        botUsername = pendingCreds.bot_username;
      } else {
        const { data: activeCreds } = await auth.supabase
          .from("vehicle_telegram_credentials")
          .select("bot_username")
          .eq("vehicle_slug", auth.slug)
          .single();

        if (!activeCreds?.bot_username) {
          return Response.json({ success: false, error: "Lütfen BotFather'dan aldığınız bot tokenını girin." }, { status: 400 });
        }
        botUsername = activeCreds.bot_username;
      }
    } else {
      // 1. Verify token with Telegram API
      const tokenCheck = await verifyBotToken(botToken.trim());
      if (!tokenCheck.valid) {
        return Response.json({ success: false, error: tokenCheck.error }, { status: 400 });
      }

      botUsername = tokenCheck.botUsername;
      const { botId } = tokenCheck;

      // 2. Ensure same bot is not used by another vehicle card in active credentials
      const { data: existing, error: existErr } = await auth.supabase
        .from("vehicle_telegram_credentials")
        .select("vehicle_slug")
        .eq("bot_id", botId)
        .neq("vehicle_slug", auth.slug)
        .limit(1);

      if (!existErr && existing && existing.length > 0) {
        return Response.json({
          success: false,
          error: "Bu bot zaten başka bir araç kartına bağlanmış. Lütfen her araç için BotFather üzerinden yeni ve ayrı bir bot oluşturun.",
        }, { status: 400 });
      }

      // 3. Encrypt bot token using AES-256-GCM
      const cipher = encryptBotToken(botToken.trim());

      // 4. Save credentials as PENDING (does not overwrite active working credentials yet!)
      const { error: upsertErr } = await auth.supabase
        .from("vehicle_telegram_credentials_pending")
        .upsert({
          vehicle_slug: auth.slug,
          bot_id: botId,
          bot_username: botUsername,
          bot_token_ciphertext: cipher.ciphertext,
          bot_token_iv: cipher.iv,
          bot_token_auth_tag: cipher.authTag,
          updated_at: new Date().toISOString(),
        }, { onConflict: "vehicle_slug" });

      if (upsertErr) {
        return Response.json({ success: false, error: "Bot bilgileri veritabanına kaydedilemedi." }, { status: 500 });
      }
    }

    // 5. Generate one-time pairing token
    const pairing = await createCardPairingToken(auth.slug, botUsername);
    if (!pairing) {
      return Response.json({ success: false, error: "Eşleştirme bağlantısı üretilemedi." }, { status: 500 });
    }

    const headers = {};
    if (auth.newSessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${auth.slug}=${auth.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      botUsername,
      deepLink: pairing.deepLink,
      pairingToken: pairing.rawToken,
      expiresAt: pairing.expiresAt,
    }, { headers });
  } catch (err) {
    console.error("[Telegram Bot API] Error:", err);
    return Response.json({
      success: false,
      error: process.env.NODE_ENV === "development" ? (err?.message || "Sunucu hatası") : "İşlem sırasında bir hata oluştu.",
    }, { status: 500 });
  }
}