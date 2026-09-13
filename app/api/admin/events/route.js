import { verifyCardAdmin } from '@/lib/security/card-auth';
import { normalizeSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const { secretKey, slug: rawSlug } = body || {};
    let slug = 'arac';
    if (rawSlug !== undefined && rawSlug !== null && rawSlug !== '') {
      const normalized = normalizeSlug(rawSlug);
      if (!normalized) {
        return Response.json({ success: false, error: 'Geçersiz araç kartı adresi biçimi.' }, { status: 400 });
      }
      slug = normalized;
    }

    // 1. Verify card-scoped admin credentials
    const authResult = await verifyCardAdmin(req, slug, secretKey);
    if (!authResult.authorized) {
      return Response.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return Response.json(
        { success: false, error: 'Veritabanı servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    // 2. Fetch latest 20 scan and scenario events for this vehicle card (NEVER admin_failed)
    const { data, error } = await supabase
      .from('vehicle_events')
      .select('id, event_type, reason, device_label, created_at')
      .eq('vehicle_slug', authResult.slug)
      .in('event_type', ['scan', 'scenario'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[Vehicle Events] Geçmiş sorgusu başarısız oldu.');
      return Response.json(
        { success: false, error: 'Olay geçmişi servisine şu anda ulaşılamıyor.' },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    // 3. Map to clean camelCase response without fingerprint hash
    const events = (data || []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      reason: row.reason,
      deviceLabel: row.device_label,
      createdAt: row.created_at,
    }));

    const headers = { 'Cache-Control': 'no-store, max-age=0' };
    if (authResult.newSessionToken) {
      headers['Set-Cookie'] = `numaratik_session_${authResult.slug}=${authResult.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({ success: true, events }, { headers });
  } catch {
    return Response.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}
