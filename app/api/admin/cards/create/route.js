import crypto from "crypto";
import { verifyCardAdmin } from "@/lib/security/card-auth";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const { secretKey, slug: rawSlug, displayName: rawDisplayName } = body || {};
    let slug = "arac";
    if (rawSlug !== undefined && rawSlug !== null && rawSlug !== "") {
      const normalized = normalizeSlug(rawSlug);
      if (!normalized) {
        return Response.json({ success: false, error: "Geçersiz araç adresi biçimi." }, { status: 400 });
      }
      slug = normalized;
    }

    // 1. Authenticate admin
    const authResult = await verifyCardAdmin(req, slug, secretKey);
    if (!authResult.authorized) {
      return Response.json(
        { success: false, error: authResult.error || "Yetkisiz işlem." },
        { status: authResult.status || 401 }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return Response.json({ success: false, error: "Veritabanı servisi yapılandırılmamış." }, { status: 503 });
    }

    const displayName = (rawDisplayName || "Yeni Araç").trim().slice(0, 50);

    // 2. Generate unique slug and activation token
    const newSlug = `card-${crypto.randomBytes(4).toString("hex")}`;
    const rawToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days valid

    // 3. Create unactivated vehicle card
    const { error: cardErr } = await supabase.from("vehicle_card").insert({
      slug: newSlug,
      display_name: displayName,
      is_activated: false,
      phone_number: null,
    });

    if (cardErr) {
      console.error("[Card Create] Kart oluşturulamadı:", cardErr.message);
      return Response.json(
        { success: false, error: "Yeni araç kartı oluşturulamadı." },
        { status: 500 }
      );
    }

    // 4. Create activation token
    const { error: tokenErr } = await supabase.from("card_activation_tokens").insert({
      vehicle_slug: newSlug,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (tokenErr) {
      console.error("[Card Create] Token oluşturulamadı:", tokenErr.message);
      // Clean up orphaned card
      await supabase.from("vehicle_card").delete().eq("slug", newSlug);
      return Response.json(
        { success: false, error: "Aktivasyon kodu oluşturulamadı." },
        { status: 500 }
      );
    }

    // Determine host for link generation
    const host = req.headers.get("host") || "numaratik.vercel.app";
    const proto = host.includes("localhost") ? "http" : "https";
    const origin = `${proto}://${host}`;

    const activationUrl = `${origin}/activate/${rawToken}`;
    const publicUrl = `${origin}/c/${newSlug}`;

    return Response.json({
      success: true,
      slug: newSlug,
      displayName,
      rawToken,
      activationUrl,
      publicUrl,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Card Create] Beklenmeyen hata:", err);
    return Response.json(
      { success: false, error: "İşlem sırasında beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}
