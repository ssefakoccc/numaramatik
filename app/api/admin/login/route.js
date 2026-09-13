import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { normalizePhoneNumber } from "@/lib/phone";
import { normalizeSlug, slugify } from "@/lib/slug";
import { verifyPassword, createCardSessionToken, verifyCsrf } from "@/lib/security/card-auth";
import { getRequestFingerprint, timingSafeCompare } from "@/lib/security/request-fingerprint";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!verifyCsrf(req)) {
      return Response.json({ success: false, error: "CSRF doğrulaması başarısız." }, { status: 403 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { identifier, password } = body;

    const cleanId = typeof identifier === "string" ? identifier.trim() : "";
    const cleanPass = typeof password === "string" ? password.trim() : "";

    if (!cleanId) {
      return Response.json({
        success: false,
        error: "Lütfen araç plakası, telefon numarası veya araç adınızı girin.",
      }, { status: 400 });
    }

    if (!cleanPass) {
      return Response.json({
        success: false,
        error: "Lütfen yönetim şifrenizi girin.",
      }, { status: 400 });
    }

    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json({ success: false, error: "Veritabanı servisi hazır değil." }, { status: 503 });
    }

    const { hash, deviceLabel } = getRequestFingerprint(req);

    // 1. Look up vehicle card candidates
    let cards = [];

    // 1a. Try Phone number lookup
    const asPhone = normalizePhoneNumber(cleanId);
    if (asPhone) {
      const { data: phoneCards } = await supabase
        .from("vehicle_card")
        .select("slug, display_name, phone_number, is_activated")
        .eq("phone_number", asPhone);
      if (phoneCards && phoneCards.length > 0) {
        cards = phoneCards;
      }
    }

    // 1b. Try Slug lookup (exact or slugified)
    if (cards.length === 0) {
      const candidateSlug = normalizeSlug(cleanId) || slugify(cleanId);
      if (candidateSlug) {
        const { data: slugCards } = await supabase
          .from("vehicle_card")
          .select("slug, display_name, phone_number, is_activated")
          .eq("slug", candidateSlug);
        if (slugCards && slugCards.length > 0) {
          cards = slugCards;
        }
      }
    }

    // 1c. Try Display Name lookup (case insensitive exact)
    if (cards.length === 0) {
      const { data: nameCards } = await supabase
        .from("vehicle_card")
        .select("slug, display_name, phone_number, is_activated")
        .ilike("display_name", cleanId);
      if (nameCards && nameCards.length > 0) {
        cards = nameCards;
      }
    }

    // 1d. Try Display Name without spaces (e.g. "34ABC123" vs "34 ABC 123")
    if (cards.length === 0) {
      const noSpaces = cleanId.replace(/\s+/g, "");
      const { data: fuzzyCards } = await supabase
        .from("vehicle_card")
        .select("slug, display_name, phone_number, is_activated")
        .ilike("slug", `%${slugify(noSpaces)}%`);
      if (fuzzyCards && fuzzyCards.length > 0) {
        cards = fuzzyCards;
      }
    }

    if (cards.length === 0) {
      return Response.json({
        success: false,
        error: "Bu plaka, telefon numarası veya araç adı ile eşleşen bir kayıt bulunamadı.",
      }, { status: 404 });
    }

    // 2. Iterate candidates and test password
    for (const card of cards) {
      // Check Rate Limit (5 failed attempts within 15 minutes)
      if (hash) {
        try {
          const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const { data: failedAttempts } = await supabase
            .from("vehicle_events")
            .select("id")
            .eq("vehicle_slug", card.slug)
            .eq("fingerprint_hash", hash)
            .eq("event_type", "admin_failed")
            .gte("created_at", fifteenMinsAgo);

          if (failedAttempts && failedAttempts.length >= 5) {
            return Response.json({
              success: false,
              error: "Çok fazla başarısız deneme yapıldı. Güvenliğiniz için lütfen 15 dakika bekleyin.",
            }, { status: 429 });
          }
        } catch {
          // Graceful fallback
        }
      }

      // Fetch admin credentials
      const { data: creds } = await supabase
        .from("vehicle_card_admin_credentials")
        .select("password_hash, password_salt")
        .eq("vehicle_slug", card.slug)
        .maybeSingle();

      let isPasswordValid = false;
      if (creds && creds.password_hash && creds.password_salt) {
        isPasswordValid = verifyPassword(cleanPass, creds.password_hash, creds.password_salt);
      } else if (card.slug === "arac") {
        const adminSecret = process.env.ADMIN_SECRET_KEY;
        if (adminSecret && adminSecret !== "gizli_sifren") {
          isPasswordValid = timingSafeCompare(cleanPass, adminSecret);
        }
      }

      if (isPasswordValid) {
        // Clear failed attempts
        if (hash) {
          try {
            await supabase
              .from("vehicle_events")
              .delete()
              .eq("vehicle_slug", card.slug)
              .eq("fingerprint_hash", hash)
              .eq("event_type", "admin_failed");
          } catch {
            // Ignore
          }
        }

        // Generate session cookie
        const sessionToken = createCardSessionToken(card.slug);
        const headers = new Headers();
        headers.append(
          "Set-Cookie",
          `numaratik_session_${card.slug}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`
        );

        return Response.json({
          success: true,
          slug: card.slug,
          displayName: card.display_name,
          redirectUrl: `/admin/${card.slug}`,
        }, { headers });
      }
    }

    // If none matched, record failure on the first card
    const targetSlug = cards[0]?.slug || "arac";
    if (hash) {
      try {
        await supabase.from("vehicle_events").insert({
          vehicle_slug: targetSlug,
          event_type: "admin_failed",
          fingerprint_hash: hash,
          device_label: deviceLabel,
        });
      } catch {
        // Ignore
      }
    }

    return Response.json({
      success: false,
      error: "Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.",
    }, { status: 401 });
  } catch (err) {
    console.error("[Admin Login Error]:", err);
    return Response.json({
      success: false,
      error: "Giriş işlemi sırasında sunucu hatası oluştu.",
    }, { status: 500 });
  }
}
