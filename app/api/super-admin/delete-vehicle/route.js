import { verifyAdminAuth } from "@/lib/security/admin-auth";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { secretKey, slug: rawSlug } = body;

    // 1. Verify Master Admin Authentication
    const auth = await verifyAdminAuth(req, secretKey);
    if (!auth.authorized) {
      return Response.json(
        { success: false, error: auth.error || "Yetkisiz erişim." },
        { status: auth.status || 401 }
      );
    }

    const supabase = auth.supabase;
    if (!supabase) {
      return Response.json(
        { success: false, error: "Veritabanı servisi hazır değil." },
        { status: 503 }
      );
    }

    // 2. Validate Slug
    const slug = normalizeSlug(rawSlug);
    if (!slug) {
      return Response.json(
        { success: false, error: "Geçersiz araç kimliği (slug)." },
        { status: 400 }
      );
    }

    // 3. Delete vehicle card (Cascades automatically in PostgreSQL)
    const { error: delErr } = await supabase
      .from("vehicle_card")
      .delete()
      .eq("slug", slug);

    if (delErr) {
      console.error("[SuperAdmin Delete] Database error:", delErr.message);
      return Response.json(
        { success: false, error: "Araç silinirken veritabanı hatası oluştu." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: `${slug} aracı ve bağlı tüm kayıtlar kalıcı olarak silindi.`,
    });
  } catch (err) {
    console.error("[SuperAdmin Delete] Sunucu hatası:", err);
    return Response.json(
      { success: false, error: "İşlem sırasında sunucu hatası oluştu." },
      { status: 500 }
    );
  }
}
