import crypto from "crypto";
import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { hashPassword, createCardSessionToken } from "@/lib/security/card-auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { slug, resetCode, newPassword } = body;

    if (!slug) {
      return Response.json({ success: false, error: "Araç kodu eksik." }, { status: 400 });
    }

    if (!resetCode || typeof resetCode !== "string" || !resetCode.trim()) {
      return Response.json({ success: false, error: "Lütfen doğrulama kodunu girin." }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 6) {
      return Response.json({ success: false, error: "Yeni şifre en az 6 karakter olmalıdır." }, { status: 400 });
    }

    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json({ success: false, error: "Veritabanı servisi hazır değil." }, { status: 503 });
    }

    const cleanCode = resetCode.trim();
    let tokenHash;
    const isRecovery = cleanCode.toUpperCase().startsWith("RC-");

    if (isRecovery) {
      tokenHash = crypto.createHash("sha256").update(`recovery:${cleanCode.toUpperCase()}`).digest("hex");
    } else {
      tokenHash = crypto.createHash("sha256").update(`reset_otp:${slug}:${cleanCode}`).digest("hex");
    }

    // Look for matching token
    const { data: record, error: tokenErr } = await supabase
      .from("card_activation_tokens")
      .select("id, expires_at, used_at")
      .eq("vehicle_slug", slug)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr || !record) {
      return Response.json({
        success: false,
        error: isRecovery ? "Kurtarma kodu geçersiz." : "Güvenlik kodu geçersiz veya bulunamadı.",
      }, { status: 400 });
    }

    if (record.used_at) {
      return Response.json({ success: false, error: "Bu kod daha önce kullanılmış." }, { status: 400 });
    }

    if (new Date(record.expires_at) < new Date()) {
      return Response.json({ success: false, error: "Güvenlik kodunun geçerlilik süresi dolmuş." }, { status: 400 });
    }

    // Mark token as used
    await supabase
      .from("card_activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", record.id);

    // Hash new password
    const { hash, salt } = hashPassword(newPassword.trim());

    // Update credentials
    const { error: updateErr } = await supabase
      .from("vehicle_card_admin_credentials")
      .upsert({
        vehicle_slug: slug,
        password_hash: hash,
        password_salt: salt,
        updated_at: new Date().toISOString(),
      });

    if (updateErr) {
      console.error("[PasswordReset] Credential update error:", updateErr.message);
      return Response.json({ success: false, error: "Şifre güncellenemedi." }, { status: 500 });
    }

    // Set authenticated session
    const sessionToken = createCardSessionToken(slug);
    const headers = {};
    if (sessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${slug}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      message: "Şifreniz başarıyla güncellendi! Giriş yapılıyor...",
    }, { headers });
  } catch (err) {
    console.error("[PasswordReset] Sunucu hatası:", err);
    return Response.json({ success: false, error: "İşlem sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
