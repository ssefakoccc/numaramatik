"use client";

import { useState, useSyncExternalStore, useMemo } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Plus,
  Copy,
  Check,
  Download,
  Share2,
  Loader2,
  Sparkles,
  Car,
  AlertCircle,
  X,
  History,
} from "lucide-react";

const HISTORY_STORAGE_KEY = "numaratik_customer_cards_history";

function getHistorySnapshot() {
  try {
    return localStorage.getItem(HISTORY_STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot() {
  return "[]";
}

function subscribe(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function CustomerQRGenerator({ slug = "arac", secretKey = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active generated card
  const [generatedCard, setGeneratedCard] = useState(null);
  const [qrSvg, setQrSvg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Read history using useSyncExternalStore
  const historyJson = useSyncExternalStore(subscribe, getHistorySnapshot, getServerSnapshot);
  const history = useMemo(() => {
    try {
      const parsed = JSON.parse(historyJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [historyJson]);

  const effectivePassword = (localPassword || secretKey || "").trim();

  const handleCreateCard = async (e) => {
    e?.preventDefault?.();
    setError(null);

    if (!effectivePassword) {
      setError("Kart oluşturmak için lütfen admin şifrenizi girin.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          secretKey: effectivePassword,
          displayName: displayName.trim() || "Yeni Araç",
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        // Generate SVG string immediately
        try {
          const svg = await QRCode.toString(data.activationUrl, {
            type: "svg",
            margin: 1,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          setQrSvg(svg);
        } catch {}

        setGeneratedCard(data);

        // Update local history
        const newHistoryItem = {
          slug: data.slug,
          displayName: data.displayName,
          activationUrl: data.activationUrl,
          createdAt: data.createdAt,
        };

        const updated = [newHistoryItem, ...history.filter((i) => i.slug !== data.slug)].slice(0, 30);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event("storage"));
        } catch {}

        setDisplayName("");
      } else {
        setError(data?.error || "Kart oluşturulamadı. Şifrenizi kontrol edin.");
      }
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFromHistory = async (item) => {
    setError(null);
    try {
      const svg = await QRCode.toString(item.activationUrl, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      setQrSvg(svg);
    } catch {}
    setGeneratedCard(item);
  };

  const handleCopy = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleDownloadQR = () => {
    if (!generatedCard?.activationUrl) return;
    QRCode.toDataURL(generatedCard.activationUrl, {
      width: 1000,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `numaratik-aktivasyon-${generatedCard.slug}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(() => {});
  };

  const handleWhatsAppShare = () => {
    if (!generatedCard?.activationUrl) return;
    const msg = `Merhaba, Numaratik araç kartınız hazır! Telefonunuzu bağlamak ve QR kodunuzu almak için bu bağlantıya tıklayın:\n${generatedCard.activationUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="w-full">
      {/* Trigger Banner */}
      <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#3B82F6]/15 via-[#1D4ED8]/10 to-transparent border border-[#3B82F6]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#60A5FA] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#F7F9FC]">Müşteri / Yeni Araç QR&apos;ı Üret</h3>
            <p className="text-[11px] text-[#98A2B3] leading-snug">
              İstediğiniz zaman tek tıkla yeni son kullanıcı aktivasyon QR&apos;ı oluşturun.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setError(null);
          }}
          className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni QR Kartı Al</span>
        </button>
      </div>

      {/* Generator Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-[440px] bg-[#080B12] border border-white/[0.1] rounded-[28px] p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center text-[#60A5FA]">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#F7F9FC]">Müşteri QR Kartı Üretici</h3>
                  <span className="text-[10px] text-[#98A2B3]">Sürekli yeni kart üretip paylaşabilirsiniz</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#98A2B3] hover:text-[#F7F9FC] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If card was just generated */}
            {generatedCard ? (
              <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in-95">
                <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-300">Aktivasyon QR&apos;ı Hazır!</span>
                  <span className="text-[10px] text-[#98A2B3] font-mono">
                    {generatedCard.slug} • {generatedCard.displayName}
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="w-[180px] h-[180px] p-3 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                  {qrSvg ? (
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <Loader2 className="w-8 h-8 text-black animate-spin" />
                  )}
                </div>

                <div className="text-[11px] text-[#98A2B3] max-w-[320px] leading-relaxed">
                  Müşteriniz bu QR kodu telefonunun kamerasıyla okutarak kendi numarasını ve şifresini belirler.
                </div>

                {/* Activation URL box */}
                <div className="w-full p-2.5 rounded-xl bg-[#0E131C] border border-white/[0.06] flex items-center justify-between gap-2 text-left">
                  <span className="text-[10px] font-mono text-[#98A2B3] truncate select-all">
                    {generatedCard.activationUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedCard.activationUrl)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-[#F7F9FC] shrink-0 flex items-center gap-1 transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedLink ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="w-full grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    className="py-2.5 px-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>QR&apos;ı İndir (PNG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp Paylaş</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setGeneratedCard(null)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[#F7F9FC] text-xs font-medium transition-colors mt-1"
                >
                  + Başka Bir Müşteri İçin Daha Üret
                </button>
              </div>
            ) : (
              /* Generator Form */
              <form onSubmit={handleCreateCard} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5">
                    Araç veya Müşteri Adı (Opsiyonel)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#98A2B3]">
                      <Car className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Örn: Ahmet Bey - 34 ABC 123"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-[#0E131C] border border-white/[0.08] focus:border-[#3B82F6] rounded-xl text-xs text-[#F7F9FC] placeholder-gray-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Admin Password Input (if not already entered) */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5">
                    Admin Şifreniz
                  </label>
                  <input
                    type="password"
                    placeholder="Admin şifrenizi girin"
                    value={localPassword || secretKey}
                    onChange={(e) => setLocalPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0E131C] border border-white/[0.08] focus:border-[#3B82F6] rounded-xl text-xs text-[#F7F9FC] placeholder-gray-500 outline-none transition-colors"
                  />
                  <span className="block text-[10px] text-[#98A2B3] mt-1">
                    Yetkisiz üretimleri engellemek için mevcut admin şifrenizle doğrulanır.
                  </span>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kart Üretiliyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Aktivasyon QR&apos;ını Oluştur</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Previously Generated Cards Accordion */}
            {history.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between text-xs text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Önceki Üretilen Kartlar ({history.length})</span>
                  </span>
                  <span>{showHistory ? "Gizle ▲" : "Göster ▼"}</span>
                </button>

                {showHistory && (
                  <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {history.map((item) => (
                      <div
                        key={item.slug}
                        className="p-2.5 rounded-xl bg-[#0E131C] border border-white/[0.05] flex items-center justify-between gap-2 text-left"
                      >
                        <div className="min-w-0 flex flex-col">
                          <span className="text-xs font-medium text-[#F7F9FC] truncate">
                            {item.displayName || item.slug}
                          </span>
                          <span className="text-[10px] font-mono text-[#98A2B3]">{item.slug}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectFromHistory(item)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[#60A5FA] text-[10px] font-medium transition-colors"
                          >
                            QR Gör
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.activationUrl)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[#98A2B3] hover:text-white text-[10px] transition-colors"
                          >
                            Kopyala
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
