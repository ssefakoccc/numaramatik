import { supabase } from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/phone';

export async function POST(req) {
  try {
    const { phone, secretKey } = await req.json();

    if (!secretKey || secretKey !== process.env.ADMIN_SECRET_KEY) {
      return Response.json({ success: false, error: 'Yetkisiz erişim: Şifre hatalı.' }, { status: 401 });
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      return Response.json(
        { success: false, error: 'Geçersiz telefon numarası. Lütfen geçerli bir cep telefonu girin (Örn: 05xx xxx xx xx).' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('vehicle_card')
      .update({ phone_number: normalized })
      .eq('slug', 'arac');

    if (error) {
      return Response.json(
        { success: false, error: 'Veritabanı güncellemesi başarısız oldu.' },
        { status: 500 }
      );
    }

    return Response.json({ success: true, phoneNumber: normalized });
  } catch (error) {
    return Response.json({ success: false, error: 'Sunucu işlemi sırasında bir hata oluştu.' }, { status: 500 });
  }
}
