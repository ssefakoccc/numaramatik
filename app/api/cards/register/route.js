import crypto from "crypto";
import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { normalizePhoneNumber } from "@/lib/phone";
import { hashPassword, createCardSessionToken } from "@/lib/security/card-auth";

export const dynamic = "force-dynamic";

/**
 * Generates a unique, collision-free vehicle slug.
 */
async function generateUniqueSlug(supabase) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomHex = crypto.randomBytes(4).toString("hex"); // e.g. 'c4a819df'
    const candidateSlug = `card-${randomHex}`;

    const { data: existing } = await supabase
      .from("vehicle_card")
      .select("slug")
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (!existing) {
      return candidateSlug;
    }
  }
  // Fallback with timestamp in extreme case
  return `card-${Date.now().toString(36)}`;
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { displayName, phone, adminPassword } = body;

    // 1. Validate Phone
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return Response.json({
        success: false,
        error: "Lütfen geçerli bir Türkiye cep telefonu girin (Örn: 0544 724 09 92).",
      }, { status: 400 });
    }

    // 2. Validate Password
    if (!adminPassword || typeof adminPassword !== "string" || adminPassword.trim().length < 6) {
      return Response.json({
        success: false,
        error: "Yönetim şifresi en az 6 karakter olmalıdır.",
      }, { status: 400 });
    }

    // 3. Clean Display Name
    const cleanName = (displayName && typeof displayName === "string" ? displayName.trim().slice(0, 40) : "") || "Araç";

    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json({
        success: false,
        error: "Veritabanı servisi hazır değil.",
      }, { status: 503 });
    }

    // 4. Generate Unique Slug
    const slug = await generateUniqueSlug(supabase);

    // 5. Hash Password
    const { hash, salt } = hashPassword(adminPassword.trim());

    // 6. Insert into vehicle_card
    const { error: cardErr } = await supabase.from("vehicle_card").insert({
      slug,
      phone_number: normalizedPhone,
      display_name: cleanName,
      is_activated: true,
    });

    if (cardErr) {
      console.error("[Register] vehicle_card insert error:", cardErr.message);
      return Response.json({
        success: false,
        error: "Araç kaydı oluşturulurken bir hata oluştu.",
      }, { status: 500 });
    }

    // 7. Insert into vehicle_card_admin_credentials
    const { error: credErr } = await supabase.from("vehicle_card_admin_credentials").insert({
      vehicle_slug: slug,
      password_hash: hash,
      password_salt: salt,
    });

    if (credErr) {
      console.error("[Register] credentials insert error:", credErr.message);
      // Clean up orphaned card
      await supabase.from("vehicle_card").delete().eq("slug", slug);
      return Response.json({
        success: false,
        error: "Güvenlik kimliği oluşturulamadı.",
      }, { status: 500 });
    }

    // 8. Create Authenticated Session Token
    const sessionToken = createCardSessionToken(slug);

    const headers = {};
    if (sessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${slug}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      slug,
      displayName: cleanName,
      phoneNumber: normalizedPhone,
      message: "Araç kartı başarıyla oluşturuldu!",
    }, { status: 201, headers });
  } catch (err) {
    console.error("[Register] Sunucu hatası:", err);
    return Response.json({
      success: false,
      error: "Kayıt işlemi sırasında bir sunucu hatası oluştu.",
    }, { status: 500 });
  }
}
