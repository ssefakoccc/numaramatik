import { getRequestFingerprint } from "@/lib/security/request-fingerprint";
import { getAdminServerClient } from "@/lib/supabase/admin-server";
import { normalizeSlug } from "@/lib/slug";
import { decryptBotToken } from "@/lib/security/token-cipher";

export const dynamic = "force-dynamic";

const ALLOWED_SCENARIO_REASONS = new Set([
  "Aracı çekebilir misiniz?",
  "Cam veya far açık",
  "Geçiş engelleniyor",
  "Acil iletişim",
]);

/**
 * Lightweight RPC caller using native fetch with connection reuse.
 */
async function callAtomicDedupRpc(params) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !url.startsWith("http")) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/log_vehicle_event_if_not_deduped`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
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

/**
 * Rolls back a reserved event row if Telegram notification delivery fails.
 */
async function rollbackReservedEvent(eventId) {
  if (!eventId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !url.startsWith("http")) return;

  try {
    await fetch(`${url}/rest/v1/vehicle_events?id=eq.${eventId}`, {
      method: "DELETE",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Suppress rollback errors
  }
}

export async function POST(req) {
  const startTotal = performance.now();
  const timings = { fpMs: 0, dbMs: 0, tgMs: 0, insertMs: 0, totalMs: 0 };
  let reservedEventId = null;

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body parse fallback
    }

    // 1. Slug resolution & strict validation
    let slug = "arac";
    if (body?.slug !== undefined && body?.slug !== null) {
      const normalized = normalizeSlug(body.slug);
      if (!normalized) {
        return Response.json({ success: false, error: "Geçersiz araç kartı adresi biçimi." }, { status: 400 });
      }
      slug = normalized;
    }

    const type = body?.type === "scenario" ? "scenario" : "scan";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

    // Validate scenario reason
    if (type === "scenario") {
      if (!reason || !ALLOWED_SCENARIO_REASONS.has(reason)) {
        return Response.json(
          { success: false, error: "Geçersiz senaryo nedeni." },
          { status: 400 }
        );
      }
    }

    const supabaseAdmin = getAdminServerClient();
    if (!supabaseAdmin) {
      return Response.json({ success: false, error: "Veritabanı servisi yapılandırılmamış." }, { status: 503 });
    }

    // 2. Fetch vehicle card for existence and display_name
    let card, cardErr;
    const initialCardRes = await supabaseAdmin
      .from("vehicle_card")
      .select("slug, display_name, is_activated")
      .eq("slug", slug)
      .single();

    if (initialCardRes.error && initialCardRes.error.message?.includes("column")) {
      // Pre-migration schema fallback (columns not yet created)
      const fallbackCardRes = await supabaseAdmin
        .from("vehicle_card")
        .select("slug")
        .eq("slug", slug)
        .single();
      if (!fallbackCardRes.error && fallbackCardRes.data) {
        card = { slug: fallbackCardRes.data.slug, display_name: "Araç", is_activated: true };
        cardErr = null;
      } else {
        cardErr = fallbackCardRes.error;
      }
    } else {
      card = initialCardRes.data;
      cardErr = initialCardRes.error;
    }

    if (cardErr || !card) {
      return Response.json({ success: false, error: "Araç kartı bulunamadı." }, { status: 404 });
    }

    if (card.is_activated === false) {
      return Response.json({ success: false, error: "Bu araç kartı henüz aktif edilmedi." }, { status: 403 });
    }

    const displayName = card.display_name || (slug === "arac" ? "Araç" : slug);

    // 3. Resolve Telegram Credentials
    let targetBotToken = null;
    let targetChatId = null;

    const { data: creds } = await supabaseAdmin
      .from("vehicle_telegram_credentials")
      .select("bot_token_ciphertext, bot_token_iv, bot_token_auth_tag, telegram_chat_id")
      .eq("vehicle_slug", slug)
      .single();

    if (creds && creds.telegram_chat_id && creds.bot_token_ciphertext) {
      try {
        targetBotToken = decryptBotToken(creds.bot_token_ciphertext, creds.bot_token_iv, creds.bot_token_auth_tag);
        targetChatId = creds.telegram_chat_id;
      } catch (err) {
        console.error("[Notify] Bot token çözülemedi:", err.message);
      }
    }

    // 4. Fingerprint calculation
    const startFp = performance.now();
    const { hash, deviceLabel } = getRequestFingerprint(req);
    timings.fpMs = +(performance.now() - startFp).toFixed(1);

    const date = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    // 5. Atomic RPC: card-scoped dedup check + atomic reserve
    let usedAtomicRpc = false;

    if (hash) {
      const startDb = performance.now();
      const rpcResult = await callAtomicDedupRpc({
        p_slug: slug,
        p_event_type: type,
        p_reason: type === "scenario" ? reason : null,
        p_fingerprint_hash: hash,
        p_device_label: deviceLabel,
      });

      if (rpcResult && typeof rpcResult === "object" && ("allowed" in rpcResult)) {
        usedAtomicRpc = true;
        timings.dbMs = +(performance.now() - startDb).toFixed(1);

        if (!rpcResult.allowed && rpcResult.deduplicated) {
          timings.totalMs = +(performance.now() - startTotal).toFixed(1);
          const isDev = process.env.NODE_ENV === "development";
          return Response.json(
            isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
            { status: 200 }
          );
        }

        if (rpcResult.allowed && rpcResult.event_id) {
          reservedEventId = rpcResult.event_id;
        }
      }
    }

    // Fallback if RPC not yet deployed
    if (!usedAtomicRpc && hash) {
      const startDbFallback = performance.now();
      try {
        if (type === "scan") {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recentScan } = await supabaseAdmin
            .from("vehicle_events")
            .select("id")
            .eq("vehicle_slug", slug)
            .eq("fingerprint_hash", hash)
            .eq("event_type", "scan")
            .gte("created_at", fiveMinutesAgo)
            .limit(1);

          if (recentScan && recentScan.length > 0) {
            timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
            timings.totalMs = +(performance.now() - startTotal).toFixed(1);
            const isDev = process.env.NODE_ENV === "development";
            return Response.json(
              isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
              { status: 200 }
            );
          }
        } else if (type === "scenario") {
          const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
          const { data: recentScenario } = await supabaseAdmin
            .from("vehicle_events")
            .select("id")
            .eq("vehicle_slug", slug)
            .eq("fingerprint_hash", hash)
            .eq("event_type", "scenario")
            .eq("reason", reason)
            .gte("created_at", sixtySecondsAgo)
            .limit(1);

          if (recentScenario && recentScenario.length > 0) {
            timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
            timings.totalMs = +(performance.now() - startTotal).toFixed(1);
            const isDev = process.env.NODE_ENV === "development";
            return Response.json(
              isDev ? { success: true, deduplicated: true, timings } : { success: true, deduplicated: true },
              { status: 200 }
            );
          }
        }
      } catch {}
      timings.dbMs = +(performance.now() - startDbFallback).toFixed(1);
    }

    // 6. If Telegram not connected for this card, skip sending Telegram without failing the user
    if (!targetBotToken || !targetChatId) {
      // If fallback DB used, record event now
      if (!usedAtomicRpc && hash) {
        try {
          await supabaseAdmin.from("vehicle_events").insert({
            vehicle_slug: slug,
            event_type: type,
            reason: type === "scenario" ? reason : null,
            fingerprint_hash: hash,
            device_label: deviceLabel,
          });
        } catch {}
      }

      timings.totalMs = +(performance.now() - startTotal).toFixed(1);
      const isDev = process.env.NODE_ENV === "development";
      const payload = { success: true, notificationSkipped: true };
      if (isDev) payload.timings = timings;
      return Response.json(payload, { status: 200 });
    }

    // 7. Format message with card display name
    let message = "";
    if (type === "scenario") {
      message = `⚠️ ${displayName} Bildirimi\nSebep: ${reason}\nTarih: ${date}\nCihaz: ${deviceLabel}`;
    } else {
      message = `🔔 ${displayName} QR Kodu Okutuldu\n\nTarih: ${date}\nCihaz: ${deviceLabel}\n\nBirisi aracınızın karekodunu görüntüledi.`;
    }

    // 8. Send Telegram message via card's bot
    const startTg = performance.now();
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: message,
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      if (reservedEventId) {
        await rollbackReservedEvent(reservedEventId);
      }
      timings.tgMs = +(performance.now() - startTg).toFixed(1);
      timings.totalMs = +(performance.now() - startTotal).toFixed(1);
      const isDev = process.env.NODE_ENV === "development";
      return Response.json(
        isDev ? { success: false, error: "Telegram bildirim iletimi zaman aşımına uğradı.", timings } : { success: false, error: "Telegram bildirim iletimi zaman aşımına uğradı." },
        { status: 502 }
      );
    }
    timings.tgMs = +(performance.now() - startTg).toFixed(1);

    if (!res.ok) {
      if (reservedEventId) {
        await rollbackReservedEvent(reservedEventId);
      }
      timings.totalMs = +(performance.now() - startTotal).toFixed(1);
      const isDev = process.env.NODE_ENV === "development";
      return Response.json(
        isDev ? { success: false, error: "Telegram bildirim iletimi başarısız.", timings } : { success: false, error: "Telegram bildirim iletimi başarısız." },
        { status: 502 }
      );
    }

    // Record event in fallback mode
    if (!usedAtomicRpc && hash) {
      const startInsert = performance.now();
      try {
        await supabaseAdmin.from("vehicle_events").insert({
          vehicle_slug: slug,
          event_type: type,
          reason: type === "scenario" ? reason : null,
          fingerprint_hash: hash,
          device_label: deviceLabel,
        });
      } catch {}
      timings.insertMs = +(performance.now() - startInsert).toFixed(1);
    }

    timings.totalMs = +(performance.now() - startTotal).toFixed(1);
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      console.log(`[Notify Timings] Total: ${timings.totalMs}ms | FP: ${timings.fpMs}ms | DB: ${timings.dbMs}ms | TG: ${timings.tgMs}ms | Insert: ${timings.insertMs}ms`);
    }

    const payload = { success: true };
    if (isDev) payload.timings = timings;
    return Response.json(payload, { status: 200 });
  } catch (err) {
    if (reservedEventId) {
      await rollbackReservedEvent(reservedEventId);
    }
    timings.totalMs = +(performance.now() - startTotal).toFixed(1);
    const isDev = process.env.NODE_ENV === "development";
    const payload = { success: false, error: "Bildirim servisi yanıt vermedi." };
    if (isDev) payload.timings = timings;
    return Response.json(payload, { status: 502 });
  }
}
