import { verifyActivationToken, activateCard } from "@/lib/security/activation";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return Response.json({ valid: false, error: "Aktivasyon kodu eksik." }, { status: 400 });
    }

    const check = await verifyActivationToken(token);
    if (!check.valid) {
      if (check.alreadyActivated) {
        return Response.json({
          valid: false,
          alreadyActivated: true,
          slug: check.slug,
          displayName: check.displayName,
          error: check.error,
        }, { status: 200 });
      }
      return Response.json({ valid: false, error: check.error }, { status: 400 });
    }

    return Response.json({
      valid: true,
      slug: check.slug,
      displayName: check.displayName,
    });
  } catch {
    return Response.json({ valid: false, error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}

    const { token, displayName, phone, adminPassword } = body;

    if (!token) {
      return Response.json({ success: false, error: "Aktivasyon kodu zorunludur." }, { status: 400 });
    }

    const result = await activateCard(token, { displayName, phone, adminPassword });

    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }

    const headers = {};
    if (result.sessionToken) {
      headers["Set-Cookie"] = `numaratik_session_${result.slug}=${result.sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
    }

    return Response.json({
      success: true,
      slug: result.slug,
      displayName: result.displayName,
      message: "Araç kartı başarıyla kuruldu ve aktif edildi!",
    }, { headers });
  } catch {
    return Response.json({ success: false, error: "Aktivasyon sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
