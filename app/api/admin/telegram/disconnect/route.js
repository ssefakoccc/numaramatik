import { verifyCardAdmin } from "@/lib/security/card-auth";
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

    // 1. Delete credentials and pending rows for this slug
    await auth.supabase
      .from("vehicle_telegram_credentials")
      .delete()
      .eq("vehicle_slug", auth.slug);

    await auth.supabase
      .from("vehicle_telegram_credentials_pending")
      .delete()
      .eq("vehicle_slug", auth.slug);

    // 2. Delete any active pairing tokens for this slug
    await auth.supabase
      .from("card_telegram_pairing_tokens")
      .delete()
      .eq("vehicle_slug", auth.slug);

    const headers = {};
    if (auth.newSessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${auth.slug}=${auth.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      message: "Telegram bağlantısı kaldırıldı. Güvenliğiniz için Telegram BotFather üzerinden botunuzun tokenını iptal (revoke) edebilirsiniz.",
    }, { headers });
  } catch (err) {
    console.error("[Disconnect API] Error:", err);
    return Response.json({
      success: false,
      error: process.env.NODE_ENV === "development" ? (err?.message || "Sunucu hatası.") : "İşlem sırasında bir hata oluştu.",
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  return POST(req);
}