export const dynamic = 'force-dynamic';

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

    let userAgent = 'Bilinmiyor';
    try {
      const body = await req.json();
      if (body?.userAgent) {
        // Strip any control characters and truncate
        userAgent = String(body.userAgent).replace(/[\r\n\t]/g, ' ').slice(0, 160);
      }
    } catch {
      // Body parse fallback
    }

    const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    // Plain text message without parse_mode to prevent markdown injection/formatting crashes
    const message = `🔔 Araç QR Kodu Okutuldu\n\nTarih: ${date}\nCihaz: ${userAgent}\n\nBirisi aracınızın karekodunu görüntüledi.`;

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
      return Response.json({ success: false, error: 'Telegram bildirim iletimi başarısız.' }, { status: 200 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: 'Bildirim servisi yanıt vermedi.' }, { status: 200 });
  }
}
