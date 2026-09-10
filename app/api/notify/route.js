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
        userAgent = String(body.userAgent).slice(0, 200);
      }
    } catch {
      // body parse error fallback
    }

    const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const message = `🔔 *Araç QR Kodu Okutuldu*\n\n📅 *Tarih:* ${date}\n📱 *Cihaz:* ${userAgent}\n\nBirisi aracınızın karekodunu görüntüledi.`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json({ success: false, error: 'Telegram bildirim iletimi başarısız.' }, { status: 200 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: 'Bildirim servisi yanıt vermedi.' }, { status: 200 });
  }
}
