import { supabase } from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('vehicle_card')
      .select('phone_number')
      .eq('slug', 'arac')
      .single();

    if (error) {
      return Response.json(
        { success: false, error: 'İletişim bilgisine şu anda ulaşılamıyor.' },
        { status: 500 }
      );
    }

    const normalized = normalizePhoneNumber(data?.phone_number);
    if (!normalized) {
      return Response.json(
        { success: false, error: 'Kayıtlı telefon numarası geçersiz.' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      phoneNumber: normalized,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
