import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { phone, secretKey } = await req.json();

    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return Response.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    const { error } = await supabase
      .from('vehicle_card')
      .update({ phone_number: phone })
      .eq('slug', 'arac');

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
