import "server-only";
import crypto from "crypto";
import { getRequestFingerprint, timingSafeCompare } from "./request-fingerprint.js";
import { getAdminServerClient } from "../supabase/admin-server.js";
import { isValidSlug, normalizeSlug } from "../slug.js";

const SESSION_COOKIE_PREFIX = "numaratik_session_";
const SESSION_MAX_AGE_SEC = 2 * 60 * 60; // 2 hours

/**
 * Derives session signing secret. Fails closed if not configured.
 * Absolutely NO hardcoded fallback key.
 */
function getSessionSecret() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const key = process.env.SESSION_SIGNING_KEY;
    if (!key || typeof key !== "string" || key.trim().length < 32) {
      throw new Error("[Security] SESSION_SIGNING_KEY is required in production and must be at least 32 characters.");
    }
    return key.trim();
  }

  // Development/Test fallback
  const secret = process.env.SESSION_SIGNING_KEY || process.env.ADMIN_SECRET_KEY;
  if (!secret || typeof secret !== "string" || secret.trim().length < 16) {
    throw new Error("[Security] SESSION_SIGNING_KEY or ADMIN_SECRET_KEY is required for session signing.");
  }
  return secret.trim();
}

/**
 * Verify Origin/Host header for CSRF defense on state-changing requests.
 */
export function verifyCsrf(req) {
  const method = req.method;
  if (method === "GET" || method === "HEAD") return true;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    // Non-browser client or direct curl (authenticated via secretKey)
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Hash password using PBKDF2-HMAC-SHA512 with a cryptographic salt.
 */
export function hashPassword(password, salt) {
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Parola en az 6 karakter olmalıdır.");
  }
  const effectiveSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, effectiveSalt, 100000, 64, "sha512").toString("hex");
  return { hash, salt: effectiveSalt };
}

/**
 * Verify password against stored hash and salt.
 */
export function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return timingSafeCompare(computed, storedHash);
  } catch {
    return false;
  }
}

/**
 * Creates a signed session token for a given card slug.
 */
export function createCardSessionToken(slug) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = `${slug}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Verifies a card session token from cookie. Ensures it matches targetSlug strictly.
 */
export function verifyCardSessionToken(token, targetSlug) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [slug, expStr, signature] = parts;
  if (slug !== targetSlug) return false;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;

  try {
    const payload = `${slug}:${expStr}`;
    const expectedSignature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
    return timingSafeCompare(signature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Reads the session cookie for the specified card slug from the request.
 */
export function getSessionTokenFromRequest(req, slug) {
  const cookieName = `${SESSION_COOKIE_PREFIX}${slug}`;
  const cookieHeader = req.headers?.get?.("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Full card-scoped admin authentication check.
 */
export async function verifyCardAdmin(req, rawSlug, secretKey) {
  // 1. Verify CSRF
  if (!verifyCsrf(req)) {
    return { authorized: false, status: 403, error: "CSRF doğrulaması başarısız." };
  }

  // 2. Validate slug format strictly
  if (!rawSlug) {
    return { authorized: false, status: 400, error: "Araç kartı adresi belirtilmedi." };
  }

  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return { authorized: false, status: 400, error: "Geçersiz araç kartı adresi biçimi." };
  }

  const supabase = getAdminServerClient();
  if (!supabase) {
    return { authorized: false, status: 503, error: "Veritabanı servisi yapılandırılmamış." };
  }

  const { hash, deviceLabel } = getRequestFingerprint(req);

  // 3. Check session cookie first
  const sessionToken = getSessionTokenFromRequest(req, slug);
  if (sessionToken && verifyCardSessionToken(sessionToken, slug)) {
    return {
      authorized: true,
      slug,
      hash,
      deviceLabel,
      supabase,
      authenticatedViaSession: true,
    };
  }

  // If no secretKey provided and session is invalid, unauthorized
  if (!secretKey) {
    return {
      authorized: false,
      status: 401,
      error: "Yetkisiz erişim. Lütfen admin şifrenizi girin.",
    };
  }

  // 4. Check Rate Limit (5 failed attempts within 15 minutes for this specific card)
  if (hash) {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: failedAttempts, error: countErr } = await supabase
        .from("vehicle_events")
        .select("id")
        .eq("vehicle_slug", slug)
        .eq("fingerprint_hash", hash)
        .eq("event_type", "admin_failed")
        .gte("created_at", fifteenMinsAgo);

      if (!countErr && failedAttempts && failedAttempts.length >= 5) {
        return {
          authorized: false,
          status: 429,
          error: "Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.",
        };
      }
    } catch {
      // Graceful fallback
    }
  }

  // 5. Fetch card info (public metadata only)
  let card, cardErr;
  const initialCardRes = await supabase
    .from("vehicle_card")
    .select("slug, is_activated")
    .eq("slug", slug)
    .single();

  if (initialCardRes.error && initialCardRes.error.message?.includes("column")) {
    // Pre-migration schema fallback
    const fallbackRes = await supabase
      .from("vehicle_card")
      .select("slug")
      .eq("slug", slug)
      .single();
    if (!fallbackRes.error && fallbackRes.data) {
      card = { slug: fallbackRes.data.slug, is_activated: true };
      cardErr = null;
    } else {
      cardErr = fallbackRes.error;
    }
  } else {
    card = initialCardRes.data;
    cardErr = initialCardRes.error;
  }

  if (cardErr || !card) {
    return {
      authorized: false,
      status: 404,
      error: "Araç kartı bulunamadı.",
    };
  }

  // 6. Fetch admin credentials strictly from private table
  let creds = null;
  try {
    const { data: credsData } = await supabase
      .from("vehicle_card_admin_credentials")
      .select("password_hash, password_salt")
      .eq("vehicle_slug", slug)
      .maybeSingle();
    creds = credsData;
  } catch {
    // Pre-migration fallback if table not yet created
    creds = null;
  }

  let isPasswordValid = false;

  if (creds && creds.password_hash && creds.password_salt) {
    isPasswordValid = verifyPassword(secretKey, creds.password_hash, creds.password_salt);
  } else if (slug === "arac") {
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (adminSecret && adminSecret !== "gizli_sifren") {
      isPasswordValid = timingSafeCompare(secretKey, adminSecret);
    }
  }

  // 7. Handle Failed Attempt
  if (!isPasswordValid) {
    if (hash) {
      try {
        await supabase.from("vehicle_events").insert({
          vehicle_slug: slug,
          event_type: "admin_failed",
          fingerprint_hash: hash,
          device_label: deviceLabel,
        });
      } catch {
        // Fallback
      }
    }

    return {
      authorized: false,
      status: 401,
      error: "Yetkisiz erişim. Şifre hatalı.",
    };
  }

  // 8. Handle Success: Clear previous failed attempts for this card & fingerprint
  if (hash) {
    try {
      await supabase
        .from("vehicle_events")
        .delete()
        .eq("vehicle_slug", slug)
        .eq("fingerprint_hash", hash)
        .eq("event_type", "admin_failed");
    } catch {
      // Fallback
    }
  }

  let newSessionToken = null;
  try {
    newSessionToken = createCardSessionToken(slug);
  } catch (err) {
    console.error("[Card Auth] Oturum jetonu üretilemedi:", err.message);
  }

  return {
    authorized: true,
    slug,
    hash,
    deviceLabel,
    supabase,
    newSessionToken,
  };
}
