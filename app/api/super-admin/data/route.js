import { verifyAdminAuth } from "@/lib/security/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek biçimi." }, { status: 400 });
    }

    const { secretKey } = body;

    // 1. Verify Master Admin Authentication
    const auth = await verifyAdminAuth(req, secretKey);
    if (!auth.authorized) {
      return Response.json(
        { success: false, error: auth.error || "Yetkisiz erişim." },
        { status: auth.status || 401 }
      );
    }

    const supabase = auth.supabase;
    if (!supabase) {
      return Response.json(
        { success: false, error: "Veritabanı servisi hazır değil." },
        { status: 503 }
      );
    }

    // 2. Fetch Aggregated Statistics
    const [
      { count: totalVehicles },
      { count: activeVehicles },
      { count: totalScans },
      { count: totalScenarios },
      { data: vehicles, error: vehErr },
      { data: tgCreds },
    ] = await Promise.all([
      supabase.from("vehicle_card").select("*", { count: "exact", head: true }),
      supabase.from("vehicle_card").select("*", { count: "exact", head: true }).eq("is_activated", true),
      supabase.from("vehicle_events").select("*", { count: "exact", head: true }).eq("event_type", "scan"),
      supabase.from("vehicle_events").select("*", { count: "exact", head: true }).eq("event_type", "scenario"),
      supabase.from("vehicle_card").select("id, slug, display_name, phone_number, is_activated, created_at").order("created_at", { ascending: false }),
      supabase.from("vehicle_telegram_credentials").select("vehicle_slug, bot_username, telegram_chat_id, connected_at"),
    ]);

    if (vehErr) {
      console.error("[SuperAdmin Data] vehicle_card query error:", vehErr.message);
      return Response.json({ success: false, error: "Araç verileri alınamadı." }, { status: 500 });
    }

    // Create Telegram lookup map
    const tgMap = new Map();
    let telegramConnectedVehicles = 0;

    if (tgCreds) {
      for (const cred of tgCreds) {
        const isConnected = Boolean(cred.telegram_chat_id);
        if (isConnected) telegramConnectedVehicles++;
        tgMap.set(cred.vehicle_slug, {
          connected: isConnected,
          botUsername: cred.bot_username || null,
          connectedAt: cred.connected_at || null,
        });
      }
    }

    // Enrich vehicle list
    const enrichedVehicles = (vehicles || []).map((v) => {
      const tgInfo = tgMap.get(v.slug) || { connected: false, botUsername: null, connectedAt: null };
      return {
        id: v.id,
        slug: v.slug,
        displayName: v.display_name,
        phoneNumber: v.phone_number,
        isActivated: v.is_activated,
        createdAt: v.created_at,
        telegram: tgInfo,
      };
    });

    return Response.json({
      success: true,
      stats: {
        totalVehicles: totalVehicles || 0,
        activeVehicles: activeVehicles || 0,
        totalScans: totalScans || 0,
        totalScenarios: totalScenarios || 0,
        telegramConnectedVehicles,
      },
      vehicles: enrichedVehicles,
    });
  } catch (err) {
    console.error("[SuperAdmin Data] Sunucu hatası:", err);
    return Response.json({ success: false, error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
