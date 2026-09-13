/**
 * Validates and normalizes vehicle card slugs.
 * Rules:
 * - Lowercase alphanumeric characters and single hyphens.
 * - Cannot start or end with a hyphen.
 * - Maximum length 50 characters.
 */
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
