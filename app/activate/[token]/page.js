"use client";

import { useState, useEffect, use } from "react";
import {
  Shield,
  Phone,
  KeyRound,
  Car,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Bot,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import QRCardDesigner from "@/components/qr/QRCardDesigner";

export default function ActivationPage({ params }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams?.token;
  const router = useRouter();

  // Initial verification states
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  // Wizard Step: 1 = Info, 2 = Password, 3 = Telegram (optional), 4 = QR Download
  const [step, setStep] = useState(1);

  // Step 1: Card info
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: Password
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState(null);

  // Activation outcome
  const [activatedSlug, setActivatedSlug] = useState(null);

  // Step 3: Telegram states
  const [showBotSetup, setShowBotSetup] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [botTesting, setBotTesting] = useState(false);
  const [botError, setBotError] = useState(null);
  const [botUsername, setBotUsername] = useState(null);
  const [pairingDeepLink, setPairingDeepLink] = useState(null);
  const [pairingToken, setPairingToken] = useState(null);
  const [pairingVerifying, setPairingVerifying] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);

  // Verify activation token on load
  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!token) {
        if (mounted) {
          setVerifying(false);
          setTokenError("Aktivasyon kodu bulunamadı.");
        }
        return;
      }
      try {
        const res = await fetch(`/api/activate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (mounted) {
          if (res.ok && data?.valid) {
            setTokenValid(true);
            setDisplayName(data.displayName || "");
          } else {
            setTokenError(data?.error || "Aktivasyon kodu geçersiz veya süresi dolmuş.");
          }
        }
      } catch {
        if (mounted) {
          setTokenError("Bağlantı hatası oluştu.");
        }
      } finally {
        if (mounted) {
          setVerifying(false);
        }
      }
    }
    void check();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Handle Step 1 -> Step 2
  const handleNextToPassword = (e) => {
    e.preventDefault();
    setStepError(null);
    if (!phone.trim()) {
      setStepError("Lütfen telefon numaranızı girin.");
      return;
    }
    setStep(2);
  };

  // Handle Step 2 (Activation submission) -> Step 3
  const handleActivateCard = async (e) => {
    e.preventDefault();
    setStepError(null);

    if (!password || password.trim().length < 6) {
      setStepError("Yönetim şifresi en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setStepError("Girdiğiniz şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName: displayName.trim() || "Araç",
          phone: phone.trim(),
          adminPassword: password.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setActivatedSlug(data.slug);
        setStep(3); // Advance to Telegram optional step
      } else {
        setStepError(data?.error || "Aktivasyon tamamlanamadı.");
      }
    } catch {
      setStepError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 Telegram: Register Bot Token
  const handleRegisterBot = async (e) => {
    e.preventDefault();
    setBotError(null);

    const cleanToken = botTokenInput.trim();
    if (!cleanToken) {
      setBotError("Lütfen bot tokenınızı girin.");
      return;
    }

    setBotTesting(true);
    try {
      const res = await fetch("/api/admin/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: activatedSlug,
          botToken: cleanToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setBotUsername(data.botUsername);
        setPairingDeepLink(data.deepLink);
        setPairingToken(data.pairingToken);
      } else {
        setBotError(data?.error || "Bot tokenı doğrulanamadı.");
      }
    } catch {
      setBotError("Sunucuya bağlanırken hata oluştu.");
    } finally {
      setBotTesting(false);
    }
  };

  // Step 3 Telegram: Verify Pairing
  const handleVerifyPairing = async () => {
    setBotError(null);
    setPairingVerifying(true);
    try {
      const res = await fetch("/api/admin/telegram/verify-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: activatedSlug,
          pairingToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setTelegramConnected(true);
        setTimeout(() => {
          setStep(4); // Advance to QR step
        }, 1200);
      } else {
        setBotError(data?.error || "Botta henüz /start komutu bulunamadı. Lütfen botunuzda Başlat'a tıklayın.");
      }
    } catch {
      setBotError("Doğrulama sırasında bağlantı hatası oluştu.");
    } finally {
      setPairingVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-[#3B82F6]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[460px] relative z-10 flex flex-col items-center">
        {/* Step Indicator */}
        {!verifying && tokenValid && (
          <div className="w-full flex items-center justify-between mb-5 px-2">
            <div className="flex items-center gap-1.5 text-xs text-[#98A2B3]">
              <span className="font-semibold text-[#F7F9FC]">Adım {step}/4:</span>
              <span>
                {step === 1 && "Kart Bilgileri"}
                {step === 2 && "Yönetim Şifresi"}
                {step === 3 && "Telegram Bildirimleri"}
                {step === 4 && "QR Tasarımı ve İndirme"}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step
                      ? "w-7 bg-[#3B82F6]"
                      : s < step
                      ? "w-3.5 bg-emerald-500"
                      : "w-3.5 bg-white/[0.1]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
          {verifying && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-[#60A5FA] animate-spin" />
              <span className="text-xs text-[#98A2B3]">Aktivasyon kodu doğrulanıyor...</span>
            </div>
          )}

          {!verifying && tokenError && (
            <div className="w-full p-5 rounded-2xl bg-[#0E131C] border border-red-500/20 text-center flex flex-col items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <h2 className="text-sm font-semibold text-[#F7F9FC]">Aktivasyon Başarısız</h2>
              <p className="text-xs text-[#98A2B3] leading-relaxed">{tokenError}</p>
            </div>
          )}

          {!verifying && tokenValid && (
            <>
              {/* ======================================================== */}
              {/* STEP 1: KART BİLGİLERİ                                   */}
              {/* ======================================================== */}
              {step === 1 && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
                    <Car className="w-6 h-6 text-[#60A5FA]" />
                  </div>

                  <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC] mb-1">
                    Araç Bilgilerini Belirleyin
                  </h1>
                  <p className="text-xs text-[#98A2B3] max-w-[300px] leading-relaxed mb-6">
                    Kartınız okutulduğunda gösterilecek araç adını ve iletişim numaranızı girin.
                  </p>

                  <form onSubmit={handleNextToPassword} className="w-full space-y-4 text-left">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                        Araç / Kart Adı
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                          <Car className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="Örn: 34 ABC 123 veya Tiggo 7 Pro"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                        Telefon Numarası
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          placeholder="0544 724 09 92"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] text-sm font-mono"
                          required
                        />
                      </div>
                    </div>

                    {stepError && (
                      <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{stepError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                    >
                      <span>Devam Et</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* ======================================================== */}
              {/* STEP 2: YÖNETİM ŞİFRESİ                                  */}
              {/* ======================================================== */}
              {step === 2 && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
                    <KeyRound className="w-6 h-6 text-[#60A5FA]" />
                  </div>

                  <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC] mb-1">
                    Yönetim Şifrenizi Belirleyin
                  </h1>
                  <p className="text-xs text-[#98A2B3] max-w-[300px] leading-relaxed mb-6">
                    Bu şifreyle kartınızın yönetim paneline giriş yaparak numaranızı ve bildirimlerinizi dilediğiniz an güncelleyebilirsiniz.
                  </p>

                  <form onSubmit={handleActivateCard} className="w-full space-y-4 text-left">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                        Yönetim Şifresi
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="En az 6 karakter"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] text-sm"
                          required
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#98A2B3] hover:text-[#F7F9FC]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                        Şifre Tekrarı
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Şifrenizi tekrar girin"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] text-sm"
                          required
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    {stepError && (
                      <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{stepError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        disabled={submitting}
                        className="py-3 px-4 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#98A2B3] hover:text-[#F7F9FC] text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Geri</span>
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-3 px-4 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-white/[0.05] disabled:text-[#667085] text-white text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Kart Aktif Ediliyor...</span>
                          </>
                        ) : (
                          <>
                            <span>Kartı Aktive Et</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ======================================================== */}
              {/* STEP 3: TELEGRAM BİLDİRİMLERİ (OPSİYONEL)                */}
              {/* ======================================================== */}
              {step === 3 && (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
                    <Bot className="w-6 h-6 text-[#60A5FA]" />
                  </div>

                  <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC] mb-1">
                    Telegram Bildirimleri
                  </h1>

                  <div className="p-3.5 rounded-2xl bg-blue-500/[0.06] border border-blue-500/20 text-left my-4 text-xs text-[#98A2B3] leading-relaxed">
                    <p>
                      QR kodunuz okutulduğunda telefonunuza anlık bildirim almak için Telegram bildirimlerini kurmanız gerekir.
                      <strong className="text-[#F7F9FC] block mt-1">
                        Bu adım isteğe bağlıdır ve daha sonra yönetim panelinden tamamlanabilir.
                      </strong>
                    </p>
                  </div>

                  {!showBotSetup && !telegramConnected && (
                    <div className="w-full space-y-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowBotSetup(true)}
                        className="w-full py-3 px-4 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Bot className="w-4 h-4" />
                        <span>Telegram Bildirimlerini Kur</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="w-full py-2.5 px-4 rounded-2xl bg-transparent border border-white/[0.08] hover:bg-white/[0.05] text-xs font-medium text-[#98A2B3] hover:text-[#F7F9FC] transition-all"
                      >
                        Şimdilik Atla
                      </button>
                    </div>
                  )}

                  {showBotSetup && !telegramConnected && (
                    <div className="w-full space-y-4 text-left">
                      {!pairingDeepLink ? (
                        <form onSubmit={handleRegisterBot} className="space-y-3">
                          <div className="p-3 rounded-xl bg-[#0E131C] border border-white/[0.05] text-[11px] text-[#98A2B3] space-y-1.5">
                            <span className="font-semibold text-[#F7F9FC] block">Nasıl Bot Oluşturulur?</span>
                            <p>1. Telegram’da <strong className="text-[#60A5FA]">@BotFather</strong> botunu açın.</p>
                            <p>2. <code className="text-white font-mono bg-white/[0.1] px-1 py-0.5 rounded">/newbot</code> yazın, bir isim ve bot kullanıcı adı belirleyin.</p>
                            <p>3. BotFather’ın verdiği HTTP API Token değerini aşağıdaki alana yapıştırın.</p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5 px-1">
                              Bot Tokenı
                            </label>
                            <input
                              type="password"
                              placeholder="1234567890:AA..."
                              value={botTokenInput}
                              onChange={(e) => setBotTokenInput(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] text-xs font-mono"
                              disabled={botTesting}
                            />
                          </div>

                          {botError && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span>{botError}</span>
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowBotSetup(false)}
                              className="py-2.5 px-3 rounded-xl bg-[#0E131C] border border-white/[0.08] text-xs text-[#98A2B3]"
                            >
                              İptal
                            </button>
                            <button
                              type="submit"
                              disabled={botTesting}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                            >
                              {botTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                              <span>Botu Doğrula</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Bot bulundu: <strong>@{botUsername}</strong></span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[#0E131C] border border-white/[0.05] text-xs text-[#98A2B3] space-y-2">
                            <p>Son Adım: Aşağıdaki butona tıklayarak botunuzda <strong>Başlat (Start)</strong> butonuna basın.</p>
                            <a
                              href={pairingDeepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2.5 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1E8BC0] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                            >
                              <span>Telegram Botunu Başlat</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {botError && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span>{botError}</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setStep(4)}
                              className="py-2.5 px-3 rounded-xl bg-[#0E131C] border border-white/[0.08] text-xs text-[#98A2B3]"
                            >
                              Şimdilik Atla
                            </button>
                            <button
                              type="button"
                              onClick={handleVerifyPairing}
                              disabled={pairingVerifying}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                            >
                              {pairingVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span>Bağlantıyı Onayla</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {telegramConnected && (
                    <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-300">Telegram Başarıyla Bağlandı!</span>
                      <span className="text-[11px] text-[#98A2B3]">QR kod tasarımına geçiliyor...</span>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* STEP 4: QR TASARIMI VE İNDİRME                           */}
              {/* ======================================================== */}
              {step === 4 && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-3">
                    <Sparkles className="w-6 h-6 text-[#60A5FA]" />
                  </div>

                  <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC] mb-1">
                    Kartınız Hazır!
                  </h1>
                  <p className="text-xs text-[#98A2B3] max-w-[320px] leading-relaxed mb-6">
                    Aşağıdan baskı önizlemenizi kontrol edebilir, PDF, PNG veya SVG formatında indirebilirsiniz.
                  </p>

                  <QRCardDesigner
                    slug={activatedSlug}
                    phone={phone}
                    displayName={displayName}
                    defaultShowPhone={true}
                    onFinish={() => router.push(`/admin/${activatedSlug}`)}
                    finishButtonText="Yönetim Paneline Git"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
