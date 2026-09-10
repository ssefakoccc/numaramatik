import { getRequestFingerprint } from '@/lib/security/request-fingerprint';
import { getAdminServerClient } from '@/lib/supabase/admin-server';

export const dynamic = 'force-dynamic';

const ALLOWED_SCENARIO_REASONS = new Set([
  'Aracı çekebilir misiniz?',
  'Cam veya far açık',
  'Geçiş engelleniyor',
  'Acil iletişim',
]);

/**
 * Lightweight RPC caller using native fetch with connection reuse.
 */
async function callAtomicDedupRpc(params) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !url.startsWith('http')) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/log_vehicle_event_if_not_deduped`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(req) {
  const startTotal = performance.now();
  const timings = { fpMs: 0, dbMs: 0, tgMs: 0, insertMs: 0, totalMs: 0 };

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

    // 1. Fingerprint calculation & timing
    const startFp = performance.now();
    const { hash, deviceLabel } = getRequestFingerprint(req);
    timings.fpMs = +(performance.now() - startFp).toFixed(1);

    const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

    // 2. Fast-path: Try Atomic RPC (single roundtrip check + insert)
    let usedAtomicRpc = false;

    if (hash) {
      const startDb = performance.now();
      const rpcResult = await callAtomicDedupRpc({
        p_slug: 'arac',
        p_event_type: type,
        p_reason: type === 'scenario' ? reason : null,
        p_fingerprint_hash: hash,
        p_device_label: deviceLabel,
      });

      if (rpcResult && typeof rpcResult === 'object' && ('allowed' in rpcResult)) {
        usedAtomicRpc = true;
        timings.dbMs = +(performance.now() - startDb).toFixed(1);

        if (!rpcResult.allowed && rpcResult.deduplicated) {
          timings.totalMs = +(performance.now() - startTotal).toFixed(1);
          const isDev = process.env.NODE_ENV === 'development';
          return Response.json(
            isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
            { status: 200 }
          );
        }
      }
    }

    // 3. Fallback: Standard query if RPC is not yet available in Supabase
    if (!usedAtomicRpc && hash) {
      const startDbFallback = performance.now();
      const supabase = getAdminServerClient();
      if (supabase) {
        try {
          if (type === 'scan') {
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
              timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
              timings.totalMs = +(performance.now() - startTotal).toFixed(1);
              const isDev = process.env.NODE_ENV === 'development';
              return Response.json(
                isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
                { status: 200 }
              );
            }
          } else if (type === 'scenario') {
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
              timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
              timings.totalMs = +(performance.now() - startTotal).toFixed(1);
              const isDev = process.env.NODE_ENV === 'development';
              return Response.json(
                isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
                { status: 200 }
              );
            }
          }
        } catch {
          // Graceful fallback
        }
      }
      timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
    }

    // 4. Prepare message
    let message = '';
    if (type === 'scenario') {
      message = `⚠️ Araç Bildirimi\nSebep: ${reason}\nTarih: ${date}\nCihaz: ${deviceLabel}`;
    } else {
      message = `🔔 Araç QR Kodu Okutuldu\n\nTarih: ${date}\nCihaz: ${deviceLabel}\n\nBirisi aracınızın karekodunu görüntüledi.`;
    }

    // 5. Send Telegram Message immediately
    const startTg = performance.now();
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
      signal: AbortSignal.timeout(4000),
    });
    timings.tgMs = +(performance.now() - startTg).toFixed(1);

    if (!res.ok) {
      timings.totalMs = +(performance.now() - startTotal).toFixed(1);
      const isDev = process.env.NODE_ENV === 'development';
      return Response.json(
        isDev ? { success: false, error: 'Telegram bildirim iletimi başarısız.', timings } : { success: false, error: 'Telegram bildirim iletimi başarısız.' },
        { status: 200 }
      );
    }

    // 6. If fallback was used, record event now
    if (!usedAtomicRpc && hash) {
      const startInsert = performance.now();
      const supabase = getAdminServerClient();
      if (supabase) {
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
      timings.insertMs = +(performance.now() - startInsert).toFixed(1);
    }

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      console.log(`[Notify Timings] Total: ${timings.totalMs}ms | FP: ${timings.fpMs}ms | DB: ${timings.dbMs}ms | TG: ${timings.tgMs}ms | Insert: ${timings.insertMs}ms`);
    }

    const payload = { success: true };
    if (isDev) {
      payload.timings = timings;
    }
    return Response.json(payload, { status: 200 });
  } catch {
    timings.totalMs = +(performance.now() - startTotal).toFixed(1);
    const isDev = process.env.NODE_ENV === 'development';
    const payload = { success: false, error: 'Bildirim servisi yanıt vermedi.' };
    if (isDev) {
      payload.timings = timings;
    }
    return Response.json(payload, { status: 200 });
  }
}
