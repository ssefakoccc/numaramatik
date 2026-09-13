import { verifyCardAdmin } from "@/lib/security/card-auth";
import { decryptBotToken } from "@/lib/security/token-cipher";
import { findStartCommandFromUpdates, sendTelegramMessage } from "@/lib/telegram/bot-client";
import { hashToken } from "@/lib/security/card-pairing";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}
    const { slug: rawSlug, secretKey, pairingToken } = body;

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

    if (!pairingToken || typeof pairingToken !== "string" || !pairingToken.trim()) {
      return Response.json({ success: false, error: "Eşleştirme kodu eksik." }, { status: 400 });
    }

    // 1. Fetch pending credentials for this card
    const { data: creds, error: credErr } = await auth.supabase
      .from("vehicle_telegram_credentials_pending")
      .select("bot_token_ciphertext, bot_token_iv, bot_token_auth_tag, bot_username")
      .eq("vehicle_slug", auth.slug)
      .single();

    if (credErr || !creds) {
      return Response.json({
        success: false,
        error: "Bu araç için bekleyen bir Telegram bot kurulumu bulunamadı. Lütfen önce bot tokenını girin.",
      }, { status: 404 });
    }

    // 2. Decrypt bot token
    const plainToken = decryptBotToken(creds.bot_token_ciphertext, creds.bot_token_iv, creds.bot_token_auth_tag);

    // 3. Query getUpdates for exact /start <pairingToken> in private chat
    const checkUpdates = await findStartCommandFromUpdates(plainToken, pairingToken.trim());
    if (!checkUpdates.found || !checkUpdates.chatId) {
      return Response.json({
        success: false,
        error: "Botunuzda /start komutu henüz bulunamadı. Lütfen Telegram uygulamasında bota Başlat dedikten sonra tekrar deneyin.",
      }, { status: 400 });
    }

    // 4. Atomically promote pending credentials and consume pairing token in single Postgres RPC
    const tokenHash = hashToken(pairingToken.trim());
    const { data: rpcResult, error: rpcErr } = await auth.supabase.rpc("complete_telegram_pairing", {
      p_slug: auth.slug,
      p_pairing_token_hash: tokenHash,
      p_chat_id: checkUpdates.chatId,
    });

    if (rpcErr || !rpcResult?.success) {
      return Response.json({
        success: false,
        error: rpcResult?.error || "Eşleştirme kaydedilemedi.",
      }, { status: 400 });
    }

    // 5. Send confirmation message to user via their newly connected bot
    const testMsg = "✅ Numaratik bağlantısı tamamlandı.\n\nBu kartın QR kodu okutulduğunda bildirimleri bu bot üzerinden alacaksınız.";
    await sendTelegramMessage(plainToken, checkUpdates.chatId, testMsg);

    const headers = {};
    if (auth.newSessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${auth.slug}=${auth.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      message: "Telegram botu başarıyla bağlandı!",
      botUsername: rpcResult.bot_username || creds.bot_username,
    }, { headers });
  } catch (err) {
    console.error("[Verify Pairing API] Error:", err);
    return Response.json({
      success: false,
      error: process.env.NODE_ENV === "development" ? (err?.message || "Sunucu hatası.") : "İşlem sırasında bir hata oluştu.",
    }, { status: 500 });
  }
}