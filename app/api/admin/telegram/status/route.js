import { verifyCardAdmin } from "@/lib/security/card-auth";
import { normalizeSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

async function handleStatus(req, rawSlug, secretKey) {
  if (!rawSlug) {
    return Response.json({ success: false, error: "Araç kartı adresi belirtilmedi." }, { status: 400 });
  }
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return Response.json({ success: false, error: "Geçersiz araç kartı adresi biçimi." }, { status: 400 });
  }

  const auth = await verifyCardAdmin(req, slug, secretKey);
  if (!auth.authorized) {
    return Response.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { data: creds } = await auth.supabase
    .from("vehicle_telegram_credentials")
    .select("bot_username, telegram_chat_id, connected_at")
    .eq("vehicle_slug", auth.slug)
    .single();

  const connected = Boolean(creds && creds.telegram_chat_id);
  const isLegacy = false;
  const botUsername = creds?.bot_username || null;

  const { data: pendingCreds } = await auth.supabase
    .from("vehicle_telegram_credentials_pending")
    .select("bot_username")
    .eq("vehicle_slug", auth.slug)
    .single();

  const headers = {};
  if (auth.newSessionToken) {
    headers["Set-Cookie"] = `numaratik_session_${auth.slug}=${auth.newSessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
  }

  return Response.json({
    success: true,
    connected,
    isLegacy,
    botConfigured: Boolean(creds),
    botUsername,
    hasPendingBot: Boolean(pendingCreds),
    pendingBotUsername: pendingCreds?.bot_username || null,
    connectedAt: creds?.connected_at || null,
  }, { headers });
}

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}
    const { slug, secretKey } = body;
    return await handleStatus(req, slug, secretKey);
  } catch {
    return Response.json({ success: false, error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    return await handleStatus(req, slug, null);
  } catch {
    return Response.json({ success: false, error: "Sunucu hatası." }, { status: 500 });
  }
}