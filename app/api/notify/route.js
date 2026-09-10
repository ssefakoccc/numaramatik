import { getRequestFingerprint } from '@/lib/security/request-fingerprint';
import { getAdminServerClient } from '@/lib/supabase/admin-server';

export const dynamic = 'force-dynamic';

const ALLOWED_SCENARIO_REASONS = new Set([
  'Aracı çekebilir misiniz?',
  'Cam veya far açık',
  'Geçiş engelleniyor',
  'Acil iletişim',
]);

export async function POST(req) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId || botToken === 'your_bot_token' || chatId === 'your_chat_id') {
      return Response.json(
        { success: false, error: 'Telegram entegrasyonu yapılandırılmamış.' },
        { status: 200 }
      );
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body parse fallback
    }

    const type = body?.type === 'scenario' ? 'scenario' : 'scan';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;

    // Validate scenario reason
    if (type === 'scenario') {
      if (!reason || !ALLOWED_SCENARIO_REASONS.has(reason)) {
        return Response.json(
          { success: false, error: 'Geçersiz senaryo nedeni.' },
          { status: 400 }
        );
      }
    }

    const { hash, deviceLabel } = getRequestFingerprint(req);
    const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const supabase = getAdminServerClient();

    // Check rate limit / deduplication from vehicle_events only when hash is available
    if (supabase && hash) {
      try {
        if (type === 'scan') {
          // 5 minutes scan deduplication
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recentScan, error: scanErr } = await supabase
            .from('vehicle_events')
            .select('id')
            .eq('vehicle_slug', 'arac')
            .eq('fingerprint_hash', hash)
            .eq('event_type', 'scan')
            .gte('created_at', fiveMinutesAgo)
            .limit(1);

          if (!scanErr && recentScan && recentScan.length > 0) {
            return Response.json({ success: true, deduplicated: true }, { status: 200 });
          }
        } else if (type === 'scenario') {
          // 60 seconds scenario deduplication for identical reason
          const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
          const { data: recentScenario, error: scenarioErr } = await supabase
            .from('vehicle_events')
            .select('id')
            .eq('vehicle_slug', 'arac')
            .eq('fingerprint_hash', hash)
            .eq('event_type', 'scenario')
            .eq('reason', reason)
            .gte('created_at', sixtySecondsAgo)
            .limit(1);

          if (!scenarioErr && recentScenario && recentScenario.length > 0) {
            return Response.json({ success: true, deduplicated: true }, { status: 200 });
          }
        }
      } catch {
        // If vehicle_events does not exist yet, continue gracefully
      }
    }

    // Prepare message
    let message = '';
    if (type === 'scenario') {
      message = `⚠️ Araç Bildirimi\nSebep: ${reason}\nTarih: ${date}\nCihaz: ${deviceLabel}`;
    } else {
      message = `🔔 Araç QR Kodu Okutuldu\n\nTarih: ${date}\nCihaz: ${deviceLabel}\n\nBirisi aracınızın karekodunu görüntüledi.`;
    }

    // Send Telegram message
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json(
        { success: false, error: 'Telegram bildirim iletimi başarısız.' },
        { status: 200 }
      );
    }

    // Record successful event in vehicle_events (graceful fallback)
    if (supabase && hash) {
      try {
        const { error: insertErr } = await supabase.from('vehicle_events').insert({
          vehicle_slug: 'arac',
          event_type: type,
          reason: type === 'scenario' ? reason : null,
          fingerprint_hash: hash,
          device_label: deviceLabel,
        });
        if (insertErr) {
          console.error('[Vehicle Events] Olay kaydı veritabanına yazılamadı.');
        }
      } catch {
        // Ignore DB insert failure if migration not yet applied
      }
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: 'Bildirim servisi yanıt vermedi.' }, { status: 200 });
  }
}
