import 'server-only';
import crypto from 'node:crypto';

/**
 * Parses raw User-Agent into a clean, human-friendly device label.
 * Possible values: 'iPhone', 'iPad', 'Android', 'Windows', 'Mac', 'Linux', 'Bilinmiyor'
 */
export function parseDeviceLabel(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'Bilinmiyor';
  const ua = userAgent.toLowerCase();
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
  if (ua.includes('linux')) return 'Linux';
  return 'Bilinmiyor';
}

/**
 * Extracts client IP from headers (x-forwarded-for first IP, fallback x-real-ip).
 * Note: IP is never logged or exposed.
 */
export function getClientIp(req) {
  if (!req || !req.headers) return '127.0.0.1';
  const xForwardedFor = req.headers.get ? req.headers.get('x-forwarded-for') : req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = req.headers.get ? req.headers.get('x-real-ip') : req.headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();
  return '127.0.0.1';
}

/**
 * Generates an HMAC-SHA256 privacy-preserving fingerprint.
 * Format: HMAC-SHA256(ADMIN_SECRET_KEY, "numaratik:v1|" + ip + "|" + normalizedUserAgent)
 * If ADMIN_SECRET_KEY is missing, returns { hash: null, deviceLabel } safely without fallback key.
 */
export function getRequestFingerprint(req) {
  const ip = getClientIp(req);
  const headerUa = req?.headers?.get ? req.headers.get('user-agent') : (req?.headers?.['user-agent'] || '');
  const normalizedUa = (headerUa || 'unknown').slice(0, 160).replace(/[\r\n\t]/g, ' ').trim();
  const deviceLabel = parseDeviceLabel(normalizedUa);

  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret || secret === 'gizli_sifren') {
    return {
      hash: null,
      deviceLabel,
    };
  }

  const message = `numaratik:v1|${ip}|${normalizedUa}`;
  const hash = crypto.createHmac('sha256', secret).update(message).digest('hex');

  return {
    hash,
    deviceLabel,
  };
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
