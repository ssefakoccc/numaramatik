"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  History,
  QrCode,
  MessageSquare,
  RefreshCw,
  Send,
  Unlink,
  ExternalLink,
  Bot,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { formatDisplayPhone, normalizePhoneNumber } from "@/lib/phone";
import QRCardDesigner from "@/components/qr/QRCardDesigner";
import CustomerQRGenerator from "@/components/admin/CustomerQRGenerator";
import { setStoredOwnerSlug, clearStoredOwnerSlug } from "@/lib/useOwnerSlug";

function formatEventDate(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

export default function AdminCardView({ slug = "arac" }) {
  const [displayName, setDisplayName] = useState(slug === "arac" ? "Araç" : slug);
  const [currentPhone, setCurrentPhone] = useState(null);
  const [newPhone, setNewPhone] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingCurrent, setFetchingCurrent] = useState(true);
  const [status, setStatus] = useState(null);

  // Telegram states
  const [tgLoading, setTgLoading] = useState(false);
  const [tgStatus, setTgStatus] = useState(null);
  const [tgActionMsg, setTgActionMsg] = useState(null);
  const [showBotWizard, setShowBotWizard] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [activePairingToken, setActivePairingToken] = useState(null);
  const [activeDeepLink, setActiveDeepLink] = useState(null);
  const [activeBotUsername, setActiveBotUsername] = useState(null);
  const [wizardStep, setWizardStep] = useState(1); // 1: token input, 2: launch & verify

  // Son Hareketler states
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  const fetchTelegramStatus = useCallback(async (key) => {
    const activeKey = (key ?? secretKey).trim();
    if (!activeKey) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, secretKey: activeKey }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setTgStatus({
          connected: data.connected,
          isLegacy: data.isLegacy,
          botConfigured: data.botConfigured,
          botUsername: data.botUsername,
          connectedAt: data.connectedAt,
        });
      }
    } catch {
      // Graceful
    } finally {
      setTgLoading(false);
    }
  }, [slug, secretKey]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const res = await fetch(`/api/phone?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await res.json();
        if (mounted && res.ok && data?.success) {
          if (data.phoneNumber) setCurrentPhone(data.phoneNumber);
          if (data.displayName) setDisplayName(data.displayName);
          if (slug) {
            setStoredOwnerSlug(slug);
          }
        }
      } catch {
        // Graceful error
      } finally {
        if (mounted) {
          setFetchingCurrent(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const handleFetchEvents = async () => {
    setEventsError(null);
    if (!secretKey.trim()) {
      setEventsError("Lütfen yukarıdaki alana admin şifrenizi girin.");
      return;
    }

    setEventsLoading(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, secretKey: secretKey.trim() }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setEvents(data.events || []);
        setEventsLoaded(true);
      } else {
        setEventsError(data?.error || "Geçmiş yüklenemedi. Şifrenizi kontrol edin.");
      }
    } catch {
      setEventsError("Geçmiş yüklenirken bir hata oluştu.");
    } finally {
      setEventsLoading(false);
    }
  };

  const handleSubmitPhone = async (e) => {
    e.preventDefault();
    setStatus(null);

    const normalized = normalizePhoneNumber(newPhone);
    if (!normalized) {
      setStatus({
        type: "error",
        message: "Lütfen geçerli bir Türkiye cep telefonu girin (Örn: 0544 724 09 92).",
      });
      return;
    }

    if (!secretKey.trim()) {
      setStatus({
        type: "error",
        message: "Lütfen admin şifrenizi girin.",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/update-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone: normalized, secretKey: secretKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setCurrentPhone(data.phoneNumber || normalized);
        setNewPhone("");
        setStatus({
          type: "success",
          message: "Telefon numarası başarıyla güncellendi. Yeni numara yayında.",
        });
        fetchTelegramStatus(secretKey);
      } else {
        setStatus({
          type: "error",
          message: data?.error || "Güncelleme başarısız oldu. Lütfen bilgilerinizi kontrol edin.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "Sunucuya bağlanırken bir hata oluştu.",
      });
    } finally {
      setLoading(false);
    }
  };

  // BotFather Wizard Step 2: Register Token
  const handleRegisterBot = async (e) => {
    e?.preventDefault();
    setTgActionMsg(null);

    if (!secretKey.trim()) {
      setTgActionMsg({ type: "error", message: "Lütfen önce admin şifrenizi girin." });
      return;
    }

    if (!botTokenInput.trim()) {
      setTgActionMsg({ type: "error", message: "Lütfen BotFather'dan aldığınız API Token'ı girin." });
      return;
    }

    setTgLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          secretKey: secretKey.trim(),
          botToken: botTokenInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success && data.deepLink) {
        setActiveBotUsername(data.botUsername);
        setActiveDeepLink(data.deepLink);
        setActivePairingToken(data.pairingToken);
        setWizardStep(2);
        setTgActionMsg({
          type: "info",
          message: `@${data.botUsername} doğrulandı. Şimdi aşağıdaki butona dokunarak botu Telegram'da başlatın.`,
        });
      } else {
        setTgActionMsg({ type: "error", message: data?.error || "Bot token doğrulanamadı." });
      }
    } catch {
      setTgActionMsg({ type: "error", message: "Bot kayıt servisine ulaşılamadı." });
    } finally {
      setTgLoading(false);
    }
  };

  // BotFather Wizard Step 4: Verify Pairing
  const handleVerifyPairing = async () => {
    setTgActionMsg(null);
    if (!secretKey.trim()) {
      setTgActionMsg({ type: "error", message: "Lütfen önce admin şifrenizi girin." });
      return;
    }

    if (!activePairingToken) {
      setTgActionMsg({ type: "error", message: "Eşleştirme kodu bulunamadı. Lütfen 2. adımı tekrarlayın." });
      return;
    }

    setTgLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/verify-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          secretKey: secretKey.trim(),
          pairingToken: activePairingToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setTgStatus({
          connected: true,
          isLegacy: false,
          botUsername: data.botUsername || activeBotUsername,
          connectedAt: new Date().toISOString(),
        });
        setShowBotWizard(false);
        setWizardStep(1);
        setActivePairingToken(null);
        setActiveDeepLink(null);
        setBotTokenInput("");
        setTgActionMsg({
          type: "success",
          message: data.message || "Telegram botunuz başarıyla bağlandı! İlk onay mesajı Telegram'a iletildi.",
        });
      } else {
        setTgActionMsg({
          type: "error",
          message: data?.error || "Eşleştirme henüz doğrulanamadı. Telegram'da bota Başlat (Start) dedikten sonra tekrar dokunun.",
        });
      }
    } catch {
      setTgActionMsg({ type: "error", message: "Eşleştirme servisine ulaşılamadı." });
    } finally {
      setTgLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    setTgActionMsg(null);
    if (!secretKey.trim()) {
      setTgActionMsg({ type: "error", message: "Lütfen önce admin şifrenizi girin." });
      return;
    }

    setTgLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, secretKey: secretKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setTgActionMsg({ type: "success", message: "Test bildirimi Telegram hesabınıza başarıyla gönderildi!" });
      } else {
        setTgActionMsg({ type: "error", message: data?.error || "Test bildirimi gönderilemedi." });
      }
    } catch {
      setTgActionMsg({ type: "error", message: "Test servisine ulaşılamadı." });
    } finally {
      setTgLoading(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    setTgActionMsg(null);
    if (!secretKey.trim()) {
      setTgActionMsg({ type: "error", message: "Lütfen önce admin şifrenizi girin." });
      return;
    }

    if (!confirm("Telegram bildirim bağlantısını kaldırmak istediğinize emin misiniz?")) {
      return;
    }

    setTgLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, secretKey: secretKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setTgStatus({ connected: false, isLegacy: false, connectedAt: null, botUsername: null });
        setShowBotWizard(false);
        setWizardStep(1);
        setTgActionMsg({ type: "success", message: "Telegram bağlantısı kaldırıldı." });
      } else {
        setTgActionMsg({ type: "error", message: data?.error || "Bağlantı kaldırılamadı." });
      }
    } catch {
      setTgActionMsg({ type: "error", message: "İşlem sırasında hata oluştu." });
    } finally {
      setTgLoading(false);
    }
  };

  const cardPublicUrl = slug === "arac" ? "/" : `/c/${slug}`;

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">
      {/* Subtle background spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.04] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
        {/* Top Navigation Bar */}
        <div className="w-full flex items-center justify-between mb-5 px-1">
          <Link
            href={cardPublicUrl}
            className="inline-flex items-center gap-1.5 text-xs text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Karta Dön ({displayName})</span>
          </Link>

          <Link
            href="/admin?switch=1"
            onClick={() => {
              clearStoredOwnerSlug();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-[#98A2B3] hover:text-[#60A5FA] transition-colors"
          >
            <span>Farklı Araç ⇄</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
          {/* Emblem */}
          <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
            <Shield className="w-6 h-6 text-[#60A5FA]" />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC]">
              {displayName}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.05] text-[#98A2B3] border border-white/[0.06]">
              {slug}
            </span>
          </div>
          <p className="text-xs text-[#98A2B3] max-w-[300px] leading-relaxed mb-5">
            QR kodunuzu indirin, telefon numaranızı ve Telegram bildirim botunuzu yönetin.
          </p>

          {/* QR Code Designer & Print Section */}
          <div className="w-full mb-6">
            <QRCardDesigner
              slug={slug}
              phone={currentPhone}
              displayName={displayName}
            />
          </div>

          {/* Customer / New Vehicle QR Generator */}
          <div className="w-full mb-6">
            <CustomerQRGenerator slug={slug} secretKey={secretKey} />
          </div>

          {/* Current Active Phone Box */}
          <div className="w-full p-3 rounded-2xl bg-[#0E131C] border border-white/[0.06] flex items-center justify-between text-xs mb-5">
            <span className="text-[#98A2B3]">Aktif Numara:</span>
            {fetchingCurrent ? (
              <span className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" />
            ) : currentPhone ? (
              <span className="font-mono font-medium text-[#60A5FA] tracking-wider">
                {formatDisplayPhone(currentPhone)}
              </span>
            ) : (
              <span className="text-white/40">Kayıtlı numara yok</span>
            )}
          </div>

          {/* Update Form */}
          <form onSubmit={handleSubmitPhone} className="w-full space-y-4 text-left">
            <div>
              <label htmlFor="new-phone-input" className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                Yeni Telefon Numarası
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="new-phone-input"
                  type="tel"
                  placeholder="0544 724 09 92"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors text-sm font-mono"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-secret-input" className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                Admin Şifresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="admin-secret-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Admin gizli şifreniz"
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(e.target.value);
                    if (e.target.value.length >= 4) {
                      fetchTelegramStatus(e.target.value);
                    }
                  }}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors text-sm"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Status Feedback */}
            {status && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                  status.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/20 text-red-300"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{status.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPhone.trim()}
              className="w-full py-3 px-4 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-white/[0.05] disabled:text-[#667085] text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <span>Numarayı Güncelle</span>
              )}
            </button>
          </form>

          {/* Telegram Notifications Section */}
          <div className="w-full mt-6 pt-6 border-t border-white/[0.06] text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#60A5FA]" />
                <h2 className="text-xs font-semibold text-[#F7F9FC]">Telegram Bildirim Botu</h2>
              </div>
              {tgStatus?.connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  Bağlı
                </span>
              )}
            </div>

            {tgActionMsg && (
              <div
                className={`p-3 rounded-xl text-xs mb-3 flex items-start gap-2 ${
                  tgActionMsg.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : tgActionMsg.type === "info"
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                    : "bg-red-500/10 border border-red-500/20 text-red-300"
                }`}
              >
                <span className="leading-relaxed">{tgActionMsg.message}</span>
              </div>
            )}

            {/* State A: Connected */}
            {tgStatus?.connected && !showBotWizard ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#0E131C] border border-white/[0.06] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#98A2B3]">Bağlı Bot:</span>
                    <span className="font-mono font-medium text-emerald-400">
                      {tgStatus.isLegacy ? "Sistem Botu (Legacy)" : `@${tgStatus.botUsername}`}
                    </span>
                  </div>
                  {tgStatus.connectedAt && (
                    <div className="text-[10px] text-[#667085]">
                      Bağlantı Tarihi: {formatEventDate(tgStatus.connectedAt)}
                    </div>
                  )}
                  {tgStatus.isLegacy && (
                    <p className="text-[11px] text-[#98A2B3] pt-1">
                      Bu kart sistem varsayılan bildirim botuna bağlı. Dilerseniz kendi özel botunuza geçiş yapabilirsiniz.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={tgLoading}
                    className="py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-[#F7F9FC] transition-colors flex items-center justify-center gap-1.5"
                  >
                    {tgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#60A5FA]" />}
                    <span>Test Gönder</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectTelegram}
                    disabled={tgLoading}
                    className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-xs font-medium text-red-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Bağlantıyı Kes</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowBotWizard(true);
                    setWizardStep(1);
                  }}
                  className="w-full py-2 text-center text-[11px] text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
                >
                  {tgStatus.isLegacy ? "Kendi Özel Botunu Bağla →" : "Farklı Bir Bot Bağla →"}
                </button>
              </div>
            ) : !tgStatus?.connected && !showBotWizard ? (
              /* State B: Telegram Disconnected / Not Setup */
              <div className="p-4 rounded-2xl bg-[#0E131C] border border-white/[0.06] space-y-3">
                <div className="flex items-start gap-3 text-left">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#F7F9FC]">Telegram Bildirimleri Kapalı</div>
                    <p className="text-[11px] text-[#98A2B3] leading-relaxed">
                      Telegram bildirimleri kapalı. QR kodunuz okutulduğunda anlık bildirim almak için kendi Telegram botunuzu bağlayabilirsiniz.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBotWizard(true);
                    setWizardStep(1);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#3B82F6]/10 hover:bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-xs font-medium text-[#60A5FA] transition-all flex items-center justify-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Telegram Bildirimlerini Kur</span>
                </button>
              </div>
            ) : (
              /* State C: BotFather Setup Wizard */
              <div className="p-4 rounded-2xl bg-[#0E131C] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-[#F7F9FC]">
                    {wizardStep === 1 ? "Bot Kurulumu (Adım 1 ve 2)" : "Bot Kurulumu (Adım 3 ve 4)"}
                  </span>
                  {showBotWizard && (
                    <button
                      type="button"
                      onClick={() => setShowBotWizard(false)}
                      className="text-[11px] text-[#98A2B3] hover:text-[#F7F9FC]"
                    >
                      İptal
                    </button>
                  )}
                </div>

                {wizardStep === 1 ? (
                  <div className="space-y-3.5 text-xs">
                    {/* Step 1 Instructions */}
                    <div className="space-y-1.5 text-[#98A2B3] bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                      <div className="font-medium text-[#F7F9FC] flex items-center gap-1.5 mb-1">
                        <span className="w-4 h-4 rounded-full bg-[#3B82F6]/20 text-[#60A5FA] flex items-center justify-center text-[10px]">1</span>
                        <span>BotFather ile Bot Oluşturun</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Telegram&apos;da <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#60A5FA] underline inline-flex items-center gap-0.5">@BotFather<ExternalLink className="w-2.5 h-2.5" /></a> botunu açıp <code className="text-[#F7F9FC] bg-white/[0.06] px-1 py-0.5 rounded">/newbot</code> komutunu gönderin. İsim belirledikten sonra verilen <strong>HTTP API Token</strong>&apos;ı kopyalayın.
                      </p>
                    </div>

                    {/* Step 2 Form */}
                    <form onSubmit={handleRegisterBot} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#98A2B3] mb-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-[#3B82F6]/20 text-[#60A5FA] flex items-center justify-center text-[10px]">2</span>
                            <span>Bot Token&apos;ını Yapıştırın</span>
                          </span>
                        </label>
                        <input
                          type="password"
                          placeholder="123456789:AAH..."
                          value={botTokenInput}
                          onChange={(e) => setBotTokenInput(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#080B12] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] font-mono text-xs"
                          disabled={tgLoading}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={tgLoading || !botTokenInput.trim()}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-white/[0.05] disabled:text-[#667085] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {tgLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Doğrulanıyor...</span>
                          </>
                        ) : (
                          <>
                            <span>Doğrula ve Devam Et</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Wizard Step 2 (Telegram Launch & Verify) */
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>@{activeBotUsername} Doğrulandı</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Botunuz başarıyla kaydedildi. Şimdi aşağıdaki iki adımı tamamlayın.
                      </p>
                    </div>

                    {/* Step 3: Launch in Telegram */}
                    <div className="space-y-1.5">
                      <div className="font-medium text-[#F7F9FC] flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#3B82F6]/20 text-[#60A5FA] flex items-center justify-center text-[10px]">3</span>
                        <span>Telegram&apos;da Başlat</span>
                      </div>
                      <p className="text-[11px] text-[#98A2B3]">
                        Açılan Telegram sohbetinde alttaki <strong>BAŞLAT (Start)</strong> butonuna dokunun:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeDeepLink) window.open(activeDeepLink, "_blank");
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#080B12] border border-[#3B82F6]/50 hover:border-[#3B82F6] text-xs font-medium text-[#60A5FA] transition-all flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Telegram&apos;da Aç ve Başlat</span>
                      </button>
                    </div>

                    {/* Step 4: Verify Pairing */}
                    <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                      <div className="font-medium text-[#F7F9FC] flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#3B82F6]/20 text-[#60A5FA] flex items-center justify-center text-[10px]">4</span>
                        <span>Bağlantıyı Tamamla</span>
                      </div>
                      <p className="text-[11px] text-[#98A2B3]">
                        Başlat dedikten hemen sonra doğrulamayı tamamlamak için dokunun:
                      </p>
                      <button
                        type="button"
                        onClick={handleVerifyPairing}
                        disabled={tgLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/[0.05] disabled:text-[#667085] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {tgLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Kontrol Ediliyor...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Bağlantıyı Doğrula ve Tamamla</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setActivePairingToken(null);
                        setActiveDeepLink(null);
                      }}
                      className="w-full py-1 text-center text-[11px] text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
                    >
                      ← Farklı Token Gir / Başa Dön
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Son Hareketler Section */}
          <div className="w-full mt-6 pt-6 border-t border-white/[0.06] text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#60A5FA]" />
                <h2 className="text-xs font-semibold text-[#F7F9FC]">Son Hareketler</h2>
              </div>
              <button
                type="button"
                onClick={handleFetchEvents}
                disabled={eventsLoading}
                className="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${eventsLoading ? "animate-spin" : ""}`} />
                <span>{eventsLoaded ? "Yenile" : "Yükle"}</span>
              </button>
            </div>

            {eventsError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 mb-3">
                {eventsError}
              </div>
            )}

            {!eventsLoaded && !eventsLoading && (
              <p className="text-xs text-[#667085] leading-relaxed">
                Şifrenizi girdikten sonra bu araca ait son 20 hareketi görüntülemek için “Yükle”ye dokunun.
              </p>
            )}

            {eventsLoading && (
              <div className="space-y-2 py-2">
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />
              </div>
            )}

            {eventsLoaded && events.length === 0 && (
              <div className="text-center py-6 text-xs text-[#667085]">
                Henüz kayıtlı bir hareket bulunmuyor.
              </div>
            )}

            {eventsLoaded && events.length > 0 && (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-[#0E131C] border border-white/[0.04] text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ev.eventType === "scenario" ? (
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <QrCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[#F7F9FC] truncate font-medium">
                          {ev.eventType === "scenario" ? ev.reason : "QR Kod Okutuldu"}
                        </div>
                        <div className="text-[10px] text-[#667085]">
                          {ev.deviceLabel || "Bilinmeyen Cihaz"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#667085] shrink-0 font-mono">
                      {formatEventDate(ev.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
