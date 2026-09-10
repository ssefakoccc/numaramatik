import { getPublicServerClient } from '@/lib/supabase/public-server';
import { normalizePhoneNumber } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getPublicServerClient();
    if (!supabase) {
      return Response.json(
        { success: false, error: 'İletişim servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('vehicle_card')
      .select('phone_number')
      .eq('slug', 'arac')
      .single();

    if (error || !data?.phone_number) {
      return Response.json(
        { success: false, error: 'İletişim bilgisine şu anda ulaşılamıyor.' },
        { status: 404 }
      );
    }

    const normalized = normalizePhoneNumber(data.phone_number);
    if (!normalized) {
      return Response.json(
        { success: false, error: 'Kayıtlı telefon numarası geçersiz.' },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      phoneNumber: normalized,
    });
  } catch {
    return Response.json(
      { success: false, error: 'İletişim bilgisine şu anda ulaşılamıyor.' },
      { status: 500 }
    );
  }
}
