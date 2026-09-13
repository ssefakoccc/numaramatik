import "server-only";

/**
 * Validates a BotFather bot token via getMe and getWebhookInfo.
 * Rejects tokens that are invalid, have an active webhook, or are not bots.
 */
export async function verifyBotToken(token) {
  if (!token || typeof token !== "string" || !token.includes(":")) {
    return { valid: false, error: "Geçersiz Telegram bot token formatı." };
  }

  const trimmed = token.trim();

  // 1. Call getMe
  let getMeRes;
  try {
    getMeRes = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`, {
      method: "GET",
      signal: AbortSignal.timeout(4500),
    });
  } catch {
    return { valid: false, error: "Telegram API sunucusuna bağlanılamadı. Tokenı ve internet bağlantısını kontrol edin." };
  }

  if (!getMeRes.ok) {
    return { valid: false, error: "Telegram bot tokenı geçersiz. Lütfen BotFather'ın verdiği tokenı kontrol edin." };
  }

  const meData = await getMeRes.json();
  if (!meData?.ok || !meData?.result?.id || !meData?.result?.username) {
    return { valid: false, error: "Bot bilgileri Telegram'dan doğrulanamadı." };
  }

  const botId = String(meData.result.id);
  const botUsername = meData.result.username;

  // 2. Call getWebhookInfo - fail closed if fails or if webhook is active
  let whRes;
  try {
    whRes = await fetch(`https://api.telegram.org/bot${trimmed}/getWebhookInfo`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return {
      valid: false,
      error: "Telegram webhook güvenlik kontrolü yapılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.",
    };
  }

  if (!whRes.ok) {
    return {
      valid: false,
      error: "Telegram webhook bilgisi alınamadı. Bot tokenını kontrol edin.",
    };
  }

  const whData = await whRes.json();
  if (!whData?.ok) {
    return {
      valid: false,
      error: "Telegram webhook yanıtı doğrulanamadı.",
    };
  }

  if (whData?.result?.url && whData.result.url.length > 0) {
    return {
      valid: false,
      error: "Bu botta aktif bir webhook tanımlı. Numaramatik için lütfen webhooku olmayan bağımsız bir bot kullanın.",
    };
  }

  return {
    valid: true,
    botId,
    botUsername,
  };
}

/**
 * Searches getUpdates for a private message matching /start <pairingToken>.
 * Strictly rejects groups, channels, and non-matching tokens.
 */
export async function findStartCommandFromUpdates(token, pairingToken) {
  if (!token || !pairingToken) return { found: false };

  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`, {
      method: "GET",
      signal: AbortSignal.timeout(4500),
    });
  } catch {
    return { found: false, error: "Telegram güncellemelerine erişilemedi." };
  }

  if (!res.ok) {
    return { found: false, error: "Telegram getUpdates isteği başarısız oldu." };
  }

  const data = await res.json();
  const updates = data?.result || [];

  for (const update of updates) {
    const msg = update?.message;
    if (!msg) continue;

    // Strictly enforce private chat (no groups, supergroups, or channels)
    if (msg.chat?.type !== "private") continue;

    const text = (msg.text || "").trim();
    if (text === `/start ${pairingToken}`) {
      return {
        found: true,
        chatId: String(msg.chat.id),
      };
    }
  }

  return { found: false };
}

/**
 * Sends a message via a specific bot token.
 */
export async function sendTelegramMessage(token, chatId, text) {
  if (!token || !chatId || !text) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
