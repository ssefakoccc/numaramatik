import { verifyCardAdmin } from "@/lib/security/card-auth";
import { decryptBotToken } from "@/lib/security/token-cipher";
import { sendTelegramMessage } from "@/lib/telegram/bot-client";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}
    const { slug: rawSlug, secretKey } = body;

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

    // Fetch card display name
    const { data: card } = await auth.supabase
      .from("vehicle_card")
      .select("display_name")
      .eq("slug", auth.slug)
      .single();

    const displayName = card?.display_name || auth.slug;
    const date = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    const text = `🧪 Test Bildirimi\n\nAraç: ${displayName}\nTarih: ${date}\n\nNumaramatik Telegram bildirim bağlantınız başarıyla çalışıyor.`;

    // Check DB credentials
    const { data: creds } = await auth.supabase
      .from("vehicle_telegram_credentials")
      .select("bot_token_ciphertext, bot_token_iv, bot_token_auth_tag, telegram_chat_id")
      .eq("vehicle_slug", auth.slug)
      .single();

    if (creds && creds.telegram_chat_id) {
      const plainToken = decryptBotToken(creds.bot_token_ciphertext, creds.bot_token_iv, creds.bot_token_auth_tag);
      const sent = await sendTelegramMessage(plainToken, creds.telegram_chat_id, text);
      if (!sent) {
        return Response.json({ success: false, error: "Telegram test bildirimi iletilemedi." }, { status: 502 });
      }
    } else {
      return Response.json({ success: false, error: "Bu araç için bağlı bir Telegram hesabı bulunamadı." }, { status: 400 });
    }

    const headers = {};
    if (auth.newSessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${auth.slug}=${auth.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({ success: true, message: "Test bildirimi başarıyla gönderildi." }, { headers });
  } catch (err) {
    console.error("[Test Telegram API] Error:", err);
    return Response.json({
      success: false,
      error: process.env.NODE_ENV === "development" ? (err?.message || "Sunucu hatası.") : "İşlem sırasında bir hata oluştu.",
    }, { status: 500 });
  }
}