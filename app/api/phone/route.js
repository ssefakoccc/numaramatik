import { getAdminServerClient } from '@/lib/supabase/admin-server';
import { normalizePhoneNumber } from '@/lib/phone';
import { normalizeSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const supabase = getAdminServerClient();
    if (!supabase) {
      return Response.json(
        { success: false, error: 'İletişim servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const rawSlug = url.searchParams.get('slug');
    let slug = 'arac';

    if (rawSlug !== null && rawSlug !== undefined && rawSlug !== '') {
      slug = normalizeSlug(rawSlug);
      if (!slug) {
        return Response.json(
          { success: false, error: 'Geçersiz araç kartı adresi biçimi.' },
          { status: 400 }
        );
      }
    }

    let data, error;
    const initialRes = await supabase
      .from('vehicle_card')
      .select('phone_number, display_name, slug, is_activated')
      .eq('slug', slug)
      .single();

    if (initialRes.error && initialRes.error.message?.includes('column')) {
      // Pre-migration schema fallback (columns not yet created)
      const fallbackRes = await supabase
        .from('vehicle_card')
        .select('phone_number, slug')
        .eq('slug', slug)
        .single();
      if (!fallbackRes.error && fallbackRes.data) {
        data = {
          phone_number: fallbackRes.data.phone_number,
          display_name: 'Araç',
          slug: fallbackRes.data.slug,
          is_activated: true,
        };
        error = null;
      } else {
        error = fallbackRes.error;
      }
    } else {
      data = initialRes.data;
      error = initialRes.error;
    }

    if (error || !data) {
      return Response.json(
        { success: false, error: 'Araç kartı bulunamadı.' },
        { status: 404 }
      );
    }

    if (data.is_activated === false) {
      return Response.json(
        {
          success: false,
          isActivated: false,
          error: 'Bu araç kartı henüz kurulmadı.',
          displayName: data.display_name || 'Araç',
          slug: data.slug,
        },
        { status: 403 }
      );
    }

    if (!data.phone_number) {
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
      isActivated: true,
      phoneNumber: normalized,
      displayName: data.display_name || 'Araç',
      slug: data.slug,
    });
  } catch {
    return Response.json(
      { success: false, error: 'İletişim bilgisine şu anda ulaşılamıyor.' },
      { status: 500 }
    );
  }
}
