import { verifyCardAdmin } from '@/lib/security/card-auth';
import { normalizePhoneNumber } from '@/lib/phone';
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

    const { phone, secretKey, slug: rawSlug } = body || {};
    let slug = 'arac';
    if (rawSlug !== undefined && rawSlug !== null && rawSlug !== '') {
      const normalized = normalizeSlug(rawSlug);
      if (!normalized) {
        return Response.json({ success: false, error: 'Geçersiz araç kartı adresi biçimi.' }, { status: 400 });
      }
      slug = normalized;
    }

    // 1. Verify card-scoped admin credentials with rate-limiting & session support
    const authResult = await verifyCardAdmin(req, slug, secretKey);
    if (!authResult.authorized) {
      return Response.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    // 2. Validate Turkey phone number strictly
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      return Response.json(
        { success: false, error: 'Geçersiz telefon numarası formatı.' },
        { status: 400 }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return Response.json(
        { success: false, error: 'Veritabanı servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    // 3. Update vehicle_card for target slug
    const { data, error } = await supabase
      .from('vehicle_card')
      .update({ phone_number: normalized })
      .eq('slug', authResult.slug)
      .select('phone_number');

    if (error || !data || data.length === 0) {
      return Response.json(
        { success: false, error: 'İşlem gerçekleştirilemedi.' },
        { status: 404 }
      );
    }

    const headers = {};
    if (authResult.newSessionToken) {
      headers['Set-Cookie'] = `numaratik_session_${authResult.slug}=${authResult.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({ success: true, phoneNumber: normalized }, { headers });
  } catch {
    return Response.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}
