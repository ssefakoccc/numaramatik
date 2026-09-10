import { getAdminServerClient } from '@/lib/supabase/admin-server';
import { normalizePhoneNumber } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret || adminSecret === 'gizli_sifren') {
      console.error('[Update Phone API] ADMIN_SECRET_KEY yapılandırılmamış.');
      return Response.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const { phone, secretKey } = body || {};

    if (!secretKey || typeof secretKey !== 'string' || secretKey !== adminSecret) {
      return Response.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      return Response.json(
        { success: false, error: 'Geçersiz telefon numarası formatı.' },
        { status: 400 }
      );
    }

    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json(
        { success: false, error: 'Veritabanı servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('vehicle_card')
      .update({ phone_number: normalized })
      .eq('slug', 'arac')
      .select('phone_number');

    if (error || !data || data.length === 0) {
      console.error('[Update Phone API] Güncelleme başarısız veya satır bulunamadı.');
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
