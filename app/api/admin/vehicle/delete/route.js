import { verifyCardAdmin } from "@/lib/security/card-auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { slug, secretKey } = body;

    // 1. Verify Card Admin
    const auth = await verifyCardAdmin(req, slug, secretKey);
    if (!auth.authorized) {
      return Response.json({ success: false, error: auth.error || "Yetkisiz erişim." }, { status: auth.status || 401 });
    }

    // 2. Delete vehicle card (cascades to all child tables)
    const { error: delErr } = await auth.supabase
      .from("vehicle_card")
      .delete()
      .eq("slug", auth.slug);

    if (delErr) {
      console.error("[DeleteVehicle] DB error:", delErr.message);
      return Response.json({ success: false, error: "Araç silinirken bir hata oluştu." }, { status: 500 });
    }

    // 3. Clear session cookie
    const headers = {
      "Set-Cookie": `numaratik_session_${auth.slug}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    };

    return Response.json({
      success: true,
      message: "Araç ve bağlı tüm veriler kalıcı olarak silindi.",
    }, { headers });
  } catch (err) {
    console.error("[DeleteVehicle] Sunucu hatası:", err);
    return Response.json({ success: false, error: "İşlem sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
