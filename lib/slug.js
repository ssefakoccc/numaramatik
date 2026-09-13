export const RESERVED_SLUGS = new Set([
  "admin",
  "yeni",
  "api",
  "c",
  "activate",
  "kayit",
  "yeni-arac",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "_next",
]);

export function isReservedSlug(slug) {
  if (!slug || typeof slug !== "string") return true;
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/**
 * Converts any vehicle name or plate into a clean, URL-safe slug.
 * e.g. "Tiggo 7 Pro" -> "tiggo-7-pro", "34 ABC 123" -> "34-abc-123"
 */
export function slugify(text) {
  if (!text || typeof text !== "string") return "";

  const trMap = {
    ç: "c", Ç: "c",
    ğ: "g", Ğ: "g",
    ı: "i", I: "i", İ: "i",
    ö: "o", Ö: "o",
    ş: "s", Ş: "s",
    ü: "u", Ü: "u",
  };

  let cleaned = text.trim();
  for (const [tr, en] of Object.entries(trMap)) {
    cleaned = cleaned.replaceAll(tr, en);
  }

  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.length === 0 || slug.length > 50) return false;
  return SLUG_REGEX.test(slug);
}

export function normalizeSlug(slug) {
  if (typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 50) return null;
  return SLUG_REGEX.test(normalized) ? normalized : null;
}
