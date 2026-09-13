import crypto from "crypto";
import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { normalizePhoneNumber } from "@/lib/phone";
import { decryptBotToken } from "@/lib/security/token-cipher";
import { sendTelegramMessage } from "@/lib/telegram/bot-client";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { slug, phone } = body;
    if (!slug) {
      return Response.json({ success: false, error: "Araç kodu belirtilmedi." }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return Response.json({
        success: false,
        error: "Lütfen geçerli bir telefon numarası girin.",
      }, { status: 400 });
    }

    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json({ success: false, error: "Veritabanı servisi hazır değil." }, { status: 503 });
    }

    // 1. Verify phone matches vehicle card
    const { data: card, error: cardErr } = await supabase
      .from("vehicle_card")
      .select("slug, phone_number, display_name")
      .eq("slug", slug)
      .maybeSingle();

    if (cardErr || !card) {
      return Response.json({ success: false, error: "Araç bulunamadı." }, { status: 404 });
    }

    if (card.phone_number !== normalizedPhone) {
      return Response.json({
        success: false,
        error: "Girdiğiniz telefon numarası bu araç ile eşleşmiyor.",
      }, { status: 400 });
    }

    // 2. Check if vehicle has Telegram connected
    const { data: tgCreds } = await supabase
      .from("vehicle_telegram_credentials")
      .select("telegram_chat_id, bot_token_ciphertext, bot_token_iv, bot_token_auth_tag")
      .eq("vehicle_slug", slug)
      .maybeSingle();

    if (tgCreds && tgCreds.telegram_chat_id && tgCreds.bot_token_ciphertext) {
      try {
        const botToken = decryptBotToken(
          tgCreds.bot_token_ciphertext,
          tgCreds.bot_token_iv,
          tgCreds.bot_token_auth_tag
        );

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto.createHash("sha256").update(`reset_otp:${slug}:${otp}`).digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

        await supabase.from("card_activation_tokens").insert({
          vehicle_slug: slug,
          token_hash: tokenHash,
          expires_at: expiresAt,
        });

        const tgText = `🔐 Numaratik Şifre Sıfırlama Kodu: ${otp}\n\nBu kod 15 dakika boyunca geçerlidir. Bu işlemi siz yapmadıysanız lütfen dikkate almayın.`;
        await sendTelegramMessage(botToken, tgCreds.telegram_chat_id, tgText);

        return Response.json({
          success: true,
          method: "telegram",
          message: "6 haneli güvenlik kodu Telegram botunuza gönderildi.",
        });
      } catch (err) {
        console.error("[PasswordReset] Telegram send error:", err);
      }
    }

    // Telegram not connected: prompt for recovery code
    return Response.json({
      success: true,
      method: "recovery_code",
      message: "Bu araçta Telegram bağlı değil. Kayıt sırasında verilen Kurtarma Kodunuzu (RC-...) girerek şifrenizi sıfırlayabilirsiniz.",
    });
  } catch (err) {
    console.error("[PasswordReset] Sunucu hatası:", err);
    return Response.json({ success: false, error: "İşlem sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
