import "server-only";
import crypto from "crypto";
import { getAdminServerClient } from "../supabase/admin-server.js";

const PAIRING_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes

export function hashToken(token) {
  if (!token || typeof token !== "string") return null;
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Creates a one-time pairing token for a card's Telegram bot.
 */
export async function createCardPairingToken(slug, botUsername) {
  const supabase = getAdminServerClient();
  if (!supabase) return null;

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PAIRING_LIFETIME_MS).toISOString();

  const { error } = await supabase.from("card_telegram_pairing_tokens").insert({
    vehicle_slug: slug,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[Card Pairing] Token oluşturulamadı.");
    return null;
  }

  const deepLink = `https://t.me/${botUsername}?start=${rawToken}`;

  return {
    rawToken,
    deepLink,
    expiresAt,
  };
}

/**
 * Validates and atomically consumes a pairing token for the given slug.
 */
export async function consumeCardPairingToken(slug, rawToken) {
  const supabase = getAdminServerClient();
  if (!supabase) return false;

  const tokenHash = hashToken(rawToken);
  if (!tokenHash) return false;

  // 1. Fetch valid token row
  const { data: row, error } = await supabase
    .from("card_telegram_pairing_tokens")
    .select("id, expires_at, used_at")
    .eq("vehicle_slug", slug)
    .eq("token_hash", tokenHash)
    .single();

  if (error || !row || row.used_at || new Date(row.expires_at) < new Date()) {
    return false;
  }

  // 2. Atomic consume
  const { data: consumed, error: consumeErr } = await supabase
    .from("card_telegram_pairing_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .single();

  return Boolean(!consumeErr && consumed);
}
