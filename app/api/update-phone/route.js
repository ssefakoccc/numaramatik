import { verifyAdminAuth } from '@/lib/security/admin-auth';
import { normalizePhoneNumber } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const { phone, secretKey } = body || {};

    // 1. Verify admin credentials with rate-limiting & timing-safe check
    const authResult = await verifyAdminAuth(req, secretKey);
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

    // 3. Update vehicle_card
    const { data, error } = await supabase
      .from('vehicle_card')
      .update({ phone_number: normalized })
      .eq('slug', 'arac')
      .select('phone_number');

    if (error || !data || data.length === 0) {
      return Response.json(
        { success: false, error: 'İşlem gerçekleştirilemedi.' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, phoneNumber: normalized });
  } catch {
    return Response.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}
