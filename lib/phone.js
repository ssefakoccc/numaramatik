/**
 * Normalizes a Turkey mobile phone number strictly to standard E.164 (+905xxxxxxxxx).
 * Accepts:
 * - 05447240992 (11 digits, starts with 05)
 * - 5447240992 (10 digits, starts with 5)
 * - 905447240992 (12 digits, starts with 905)
 * - +905447240992
 * - And any spaced, punctuated equivalents.
 *
 * Rejects any non-TR or invalid numbers.
 *
 * @param {string} input
 * @returns {string|null} Strict +905xxxxxxxxx or null if invalid.
 */
export function normalizePhoneNumber(input) {
  if (!input || typeof input !== 'string') return null;

  const digits = input.replace(/\D/g, '');

  let normalized = null;

  // 10 digits: 5xxxxxxxxx
  if (digits.length === 10 && digits.startsWith('5')) {
    normalized = `+90${digits}`;
  }
  // 11 digits: 05xxxxxxxxx
  else if (digits.length === 11 && digits.startsWith('05')) {
    normalized = `+90${digits.slice(1)}`;
  }
  // 12 digits: 905xxxxxxxxx
  else if (digits.length === 12 && digits.startsWith('905')) {
    normalized = `+${digits}`;
  }

  // Strict verification: must be +905 followed by exactly 9 digits (total 13 chars)
  if (normalized && /^\+905\d{9}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Formats a normalized phone number for clean human-readable UI display.
 * Example: +905447240992 -> +90 544 724 09 92
 *
 * @param {string} phone
 * @returns {string}
 */
export function formatDisplayPhone(phone) {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone) || phone;

  if (normalized.startsWith('+90') && normalized.length === 13) {
    const p1 = normalized.slice(0, 3);   // +90
    const p2 = normalized.slice(3, 6);   // 544
    const p3 = normalized.slice(6, 9);   // 724
    const p4 = normalized.slice(9, 11);  // 09
    const p5 = normalized.slice(11, 13); // 92
    return `${p1} ${p2} ${p3} ${p4} ${p5}`;
  }

  return normalized;
}

/**
 * Generates a valid tel: URL or null.
 */
export function getTelLink(phone) {
  const norm = normalizePhoneNumber(phone);
  return norm ? `tel:${norm}` : null;
}

/**
 * Generates a valid WhatsApp click-to-chat URL or null.
 */
export function getWhatsAppLink(phone, message = '') {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return null;
  const digits = norm.replace(/\D/g, '');
  const encodedMsg = encodeURIComponent(message.trim());
  return `https://wa.me/${digits}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
}

/**
 * Generates a valid SMS URL or null.
 */
export function getSmsLink(phone, message = '') {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return null;
  const encodedMsg = encodeURIComponent(message.trim());
  return `sms:${norm}${encodedMsg ? `?body=${encodedMsg}` : ''}`;
}
