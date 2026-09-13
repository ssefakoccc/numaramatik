import "server-only";
import crypto from "crypto";
import { getAdminServerClient } from "../supabase/admin-server.js";
import { normalizePhoneNumber } from "../phone.js";
import { hashPassword, createCardSessionToken } from "./card-auth.js";

export function hashActivationToken(token) {
  if (!token || typeof token !== "string") return null;
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Creates a one-time activation token for a new vehicle card.
 */
export async function createActivationToken(slug, lifetimeDays = 30) {
  const supabase = getAdminServerClient();
  if (!supabase) return null;

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashActivationToken(rawToken);
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("card_activation_tokens").insert({
    vehicle_slug: slug,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[Activation] Token oluşturulamadı:", error.message);
    return null;
  }

  return {
    rawToken,
    expiresAt,
  };
}

/**
 * Verifies if an activation token is valid and unconsumed.
 */
export async function verifyActivationToken(rawToken) {
  const supabase = getAdminServerClient();
  if (!supabase) return { valid: false, error: "Veritabanı servisi hazır değil." };

  const tokenHash = hashActivationToken(rawToken);
  if (!tokenHash) return { valid: false, error: "Geçersiz aktivasyon kodu." };

  const { data: record, error } = await supabase
    .from("card_activation_tokens")
    .select("id, vehicle_slug, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !record) {
    return { valid: false, error: "Aktivasyon kodu bulunamadı." };
  }

  // Check card status
  const { data: card } = await supabase
    .from("vehicle_card")
    .select("slug, display_name, is_activated")
    .eq("slug", record.vehicle_slug)
    .maybeSingle();

  if (record.used_at || card?.is_activated) {
    return {
      valid: false,
      alreadyActivated: true,
      slug: record.vehicle_slug,
      displayName: card?.display_name || "Araç",
      error: "Bu araç kartı başarıyla kurulmuştur.",
    };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: "Aktivasyon kodunun geçerlilik süresi dolmuş." };
  }

  if (!card) {
    return { valid: false, error: "Bağlı araç kartı bulunamadı." };
  }

  return {
    valid: true,
    tokenId: record.id,
    slug: card.slug,
    displayName: card.display_name,
  };
}

/**
 * Atomically activates a card and sets its phone, name, and hashed password.
 */
export async function activateCard(rawToken, { displayName, phone, adminPassword }) {
  const tokenHash = hashActivationToken(rawToken);
  if (!tokenHash) {
    return { success: false, error: "Geçersiz aktivasyon kodu." };
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Lütfen geçerli bir Türkiye cep telefonu girin (Örn: 0544 724 09 92)." };
  }

  if (!adminPassword || typeof adminPassword !== "string" || adminPassword.trim().length < 6) {
    return { success: false, error: "Admin şifresi en az 6 karakter olmalıdır." };
  }

  const cleanName = (displayName || "").trim() || "Araç";
  const { hash, salt } = hashPassword(adminPassword.trim());
  const supabase = getAdminServerClient();
  if (!supabase) {
    return { success: false, error: "Veritabanı bağlantısı sağlanamadı." };
  }

  // Atomically lock, verify, update card and consume token in single PostgreSQL transaction
  const { data: result, error: rpcErr } = await supabase.rpc("activate_vehicle_card", {
    p_token_hash: tokenHash,
    p_phone_number: normalizedPhone,
    p_display_name: cleanName,
    p_password_hash: hash,
    p_password_salt: salt,
  });

  if (rpcErr || !result?.success) {
    return {
      success: false,
      error: result?.error || "Aktivasyon işlemi gerçekleştirilemedi.",
    };
  }

  const sessionToken = createCardSessionToken(result.slug);

  return {
    success: true,
    slug: result.slug,
    displayName: cleanName,
    phoneNumber: normalizedPhone,
    sessionToken,
  };
}
