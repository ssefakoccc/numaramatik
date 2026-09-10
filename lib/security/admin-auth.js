import 'server-only';
import { getRequestFingerprint, timingSafeCompare } from './request-fingerprint';
import { getAdminServerClient } from '../supabase/admin-server';

/**
 * Validates admin credentials with rate-limiting and audit tracking.
 * - Enforces max 5 failed attempts in 15 minutes per fingerprint hash (429 Too Many Requests).
 * - Records 'admin_failed' on incorrect attempts.
 * - Cleans up 'admin_failed' events on successful login.
 * - Fallbacks gracefully if vehicle_events table is not yet migrated.
 */
export async function verifyAdminAuth(req, secretKey) {
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  if (!adminSecret || adminSecret === 'gizli_sifren') {
    return {
      authorized: false,
      status: 401,
      error: 'Yetkisiz erişim.',
    };
  }

  const { hash, deviceLabel } = getRequestFingerprint(req);
  const supabase = getAdminServerClient();

  // 1. Check Rate Limit (5 failed attempts within 15 minutes)
  if (supabase && hash) {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: failedAttempts, error: countErr } = await supabase
        .from('vehicle_events')
        .select('id')
        .eq('vehicle_slug', 'arac')
        .eq('fingerprint_hash', hash)
        .eq('event_type', 'admin_failed')
        .gte('created_at', fifteenMinsAgo);

      if (!countErr && failedAttempts && failedAttempts.length >= 5) {
        return {
          authorized: false,
          status: 429,
          error: 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.',
        };
      }
    } catch {
      // Graceful fallback if vehicle_events table does not exist yet
    }
  }

  // 2. Timing-safe comparison of password
  const isPasswordValid = Boolean(secretKey && timingSafeCompare(secretKey, adminSecret));

  // 3. Handle Failed Attempt
  if (!isPasswordValid) {
    if (supabase && hash) {
      try {
        const { error: insertErr } = await supabase.from('vehicle_events').insert({
          vehicle_slug: 'arac',
          event_type: 'admin_failed',
          fingerprint_hash: hash,
          device_label: deviceLabel,
        });
        if (insertErr) {
          console.error('[Admin Auth] Başarısız deneme kaydı veritabanına yazılamadı.');
        }
      } catch {
        // Fallback
      }
    }

    return {
      authorized: false,
      status: 401,
      error: 'Yetkisiz erişim.',
    };
  }

  // 4. Handle Success: Clear previous failed attempts for this fingerprint
  if (supabase && hash) {
    try {
      const { error: deleteErr } = await supabase
        .from('vehicle_events')
        .delete()
        .eq('vehicle_slug', 'arac')
        .eq('fingerprint_hash', hash)
        .eq('event_type', 'admin_failed');
      if (deleteErr) {
        console.error('[Admin Auth] Başarısız deneme kayıtları temizlenemedi.');
      }
    } catch {
      // Fallback
    }
  }

  return {
    authorized: true,
    hash,
    deviceLabel,
    supabase,
  };
}
