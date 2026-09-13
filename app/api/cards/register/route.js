import crypto from "crypto";
import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { normalizePhoneNumber } from "@/lib/phone";
import { hashPassword, createCardSessionToken } from "@/lib/security/card-auth";
import { slugify, isReservedSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * Resolves a unique slug, avoiding collisions and reserved words.
 */
async function resolveUniqueSlug(supabase, requestedSlug) {
  let baseSlug = slugify(requestedSlug);

  if (!baseSlug || isReservedSlug(baseSlug)) {
    baseSlug = baseSlug ? `${baseSlug}-arac` : `card-${crypto.randomBytes(4).toString("hex")}`;
  }

  let candidateSlug = baseSlug;
  let counter = 1;

  while (counter <= 20) {
    const { data: existing } = await supabase
      .from("vehicle_card")
      .select("slug")
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (!existing) {
      return candidateSlug;
    }

    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  // Fallback in extreme collision case
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { displayName, phone, adminPassword, customSlug } = body;

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

    // 4. Resolve Unique Slug
    const requested = (customSlug && typeof customSlug === "string" && customSlug.trim()) || cleanName;
    const slug = await resolveUniqueSlug(supabase, requested);

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
      await supabase.from("vehicle_card").delete().eq("slug", slug);
      return Response.json({
        success: false,
        error: "Güvenlik kimliği oluşturulamadı.",
      }, { status: 500 });
    }

    // 8. Generate & Store Recovery Code for Password Reset
    const rawRecoveryCode = `RC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const recoveryHash = crypto.createHash("sha256").update(`recovery:${rawRecoveryCode}`).digest("hex");
    const recoveryExpires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 10 years

    try {
      await supabase.from("card_activation_tokens").insert({
        vehicle_slug: slug,
        token_hash: recoveryHash,
        expires_at: recoveryExpires,
      });
    } catch (tokenErr) {
      console.error("[Register] recovery token save error:", tokenErr);
    }

    // 9. Create Authenticated Session Token
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
      recoveryCode: rawRecoveryCode,
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
