export async function POST(req) {
  try {
    const { userAgent } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const date = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const message = `🚨 *Araç QR Kodu Okutuldu!*\n\n📅 *Tarih:* ${date}\n📱 *Cihaz:* ${userAgent || 'Bilinmiyor'}\n\nBirisi aracınızın başından QR kodu tarattı.`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
