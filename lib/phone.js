/**
 * Normalizes phone numbers to standard E.164-like format (e.g. +905447240992).
 * Supports TR formats: 05xx, 5xx, 905xx, +905xx.
 * 
 * @param {string} input 
 * @returns {string|null} Normalized phone number or null if invalid.
 */
export function normalizePhoneNumber(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Türkiye cep telefonları kontrolü:
  // 10 hane: 5xxxxxxxxx
  if (digitsOnly.length === 10 && digitsOnly.startsWith('5')) {
    return `+90${digitsOnly}`;
  }
  // 11 hane: 05xxxxxxxxx
  if (digitsOnly.length === 11 && digitsOnly.startsWith('05')) {
    return `+90${digitsOnly.slice(1)}`;
  }
  // 12 hane: 905xxxxxxxxx
  if (digitsOnly.length === 12 && digitsOnly.startsWith('905')) {
    return `+${digitsOnly}`;
  }
  // 13 hane veya genel uluslararası numara (+ ile başlayan)
  if (trimmed.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
  }

  // Genel geçerli rakam uzunluğu (10-15 hane)
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
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

  // Türkiye formatı (+905XXXXXXXXX)
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
