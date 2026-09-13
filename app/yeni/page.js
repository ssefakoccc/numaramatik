"use client";

import { useState } from "react";
import {
  Shield,
  Phone,
  KeyRound,
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
  Sparkles,
  Check,
  Car,
} from "lucide-react";
import Link from "next/link";
import QRCardDesigner from "@/components/qr/QRCardDesigner";
import { setStoredOwnerSlug } from "@/lib/useOwnerSlug";
import { normalizePhoneNumber } from "@/lib/phone";

export default function YeniAracPage() {
  // Wizard Step: 1 = Register Info, 2 = Telegram (Optional), 3 = Card Ready & Download
  const [step, setStep] = useState(1);

  // Step 1 Form States
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState(null);

  // Created Vehicle State
  const [createdSlug, setCreatedSlug] = useState(null);
  const [confirmedName, setConfirmedName] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState("");

  // Step 2 Telegram States
  const [showBotSetup, setShowBotSetup] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [botTesting, setBotTesting] = useState(false);
  const [botError, setBotError] = useState(null);
  const [botUsername, setBotUsername] = useState(null);
  const [pairingDeepLink, setPairingDeepLink] = useState(null);
  const [pairingToken, setPairingToken] = useState(null);
  const [pairingVerifying, setPairingVerifying] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);

  // Step 1: Submit Registration
  const handleRegister = async (e) => {
    e?.preventDefault();
    setStepError(null);

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setStepError("Lütfen telefon numaranızı girin.");
      return;
    }

    const normalized = normalizePhoneNumber(cleanPhone);
    if (!normalized) {
      setStepError("Lütfen geçerli bir Türkiye cep telefonu numarası girin (Örn: 0544 724 09 92).");
      return;
    }

    if (!password || password.length < 6) {
      setStepError("Yönetim şifresi en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setStepError("Girdiğiniz şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cards/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || "Araç",
          phone: normalized,
          adminPassword: password.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success && data?.slug) {
        setCreatedSlug(data.slug);
        setConfirmedName(data.displayName || "Araç");
        setConfirmedPhone(data.phoneNumber || normalized);
        // Persist on this device so admin knows this vehicle
        setStoredOwnerSlug(data.slug);
        // Move to Telegram step
        setStep(2);
      } else {
        setStepError(data?.error || "Kayıt işlemi gerçekleştirilemedi. Lütfen tekrar deneyin.");
      }
    } catch {
      setStepError("Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Test & Register Bot Token
  const handleConnectBot = async (e) => {
    e?.preventDefault();
    setBotError(null);

    if (!botTokenInput.trim()) {
      setBotError("Lütfen BotFather'dan aldığınız API Token'ı girin.");
      return;
    }

    setBotTesting(true);
    try {
      const res = await fetch("/api/admin/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: createdSlug,
          secretKey: password.trim(),
          botToken: botTokenInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success && data.deepLink) {
        setBotUsername(data.botUsername);
        setPairingDeepLink(data.deepLink);
        setPairingToken(data.pairingToken);
      } else {
        setBotError(data?.error || "Bot token doğrulanamadı. Lütfen token'ı kontrol edin.");
      }
    } catch {
      setBotError("Bot servisine bağlanılamadı.");
    } finally {
      setBotTesting(false);
    }
  };

  // Step 2: Verify Pairing
  const handleVerifyPairing = async () => {
    setBotError(null);
    if (!pairingToken) {
      setBotError("Eşleştirme kodu bulunamadı. Lütfen bot token'ı tekrar girin.");
      return;
    }

    setPairingVerifying(true);
    try {
      const res = await fetch("/api/admin/telegram/verify-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: createdSlug,
          secretKey: password.trim(),
          pairingToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setTelegramConnected(true);
        setTimeout(() => {
          setStep(3);
        }, 1200);
      } else {
        setBotError(data?.error || "Eşleştirme henüz tamamlanmadı. Lütfen Telegram'da botu başlattığınızdan emin olun.");
      }
    } catch {
      setBotError("Doğrulama servisine bağlanılamadı.");
    } finally {
      setPairingVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">
      {/* Subtle radial spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.05] via-[#141A24]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
        {/* Step Indicator Bar */}
        <div className="w-full flex items-center justify-between mb-5 px-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-[#3B82F6] uppercase">NUMARATİK</span>
            <span className="text-white/20">/</span>
            <span className="text-xs text-[#98A2B3]">
              {step === 1 && "Yeni Araç Kaydı"}
              {step === 2 && "Telegram Kurulumu"}
              {step === 3 && "Karekod Kartınız Hazır"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-[#3B82F6]" : "bg-white/20"}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-[#3B82F6]" : "bg-white/20"}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 3 ? "bg-[#3B82F6]" : "bg-white/20"}`} />
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ADIM 1: ARAÇ BİLGİLERİ VE ŞİFRE BELİRLEME                     */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
            {/* Header Emblem */}
            <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
              <Car className="w-7 h-7 text-[#3B82F6]" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-[#F7F9FC] mb-1.5">
              Yeni Araç Kaydı Oluşturun
            </h1>
            <p className="text-xs text-[#98A2B3] max-w-[280px] mb-6">
              Aracınız için saniyeler içinde akıllı karekod oluşturun ve anında kullanmaya başlayın.
            </p>

            {/* Error Message */}
            {stepError && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{stepError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="w-full flex flex-col gap-4 text-left">
              {/* Araç Plakası veya Adı */}
              <div>
                <label className="block text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider mb-1.5">
                  Araç Plakası veya Adı
                </label>
                <div className="relative">
                  <Car className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Örn: 34 ABC 123 veya Aracım"
                    maxLength={40}
                    className="w-full pl-10 pr-4 py-3 bg-[#0E131C] border border-white/[0.08] rounded-2xl text-[#F7F9FC] placeholder-[#98A2B3]/50 text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                  />
                </div>
              </div>

              {/* İletişim Numarası */}
              <div>
                <label className="block text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider mb-1.5">
                  İletişim Telefon Numarası <span className="text-[#3B82F6]">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0544 724 09 92"
                    className="w-full pl-10 pr-4 py-3 bg-[#0E131C] border border-white/[0.08] rounded-2xl text-[#F7F9FC] placeholder-[#98A2B3]/50 text-sm font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
                  />
                </div>
                <span className="text-[10px] text-[#98A2B3] mt-1 block">
                  Karekod okutulduğunda arayanların size ulaşacağı numara.
                </span>
              </div>

              {/* Yönetim Şifresi */}
              <div>
                <label className="block text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider mb-1.5">
                  Yönetim Şifresi Belirleyin <span className="text-[#3B82F6]">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full pl-10 pr-10 py-3 bg-[#0E131C] border border-white/[0.08] rounded-2xl text-[#F7F9FC] placeholder-[#98A2B3]/50 text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Şifre Tekrarı */}
              <div>
                <label className="block text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider mb-1.5">
                  Şifre Tekrarı <span className="text-[#3B82F6]">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Şifrenizi tekrar yazın"
                    className="w-full pl-10 pr-4 py-3 bg-[#0E131C] border border-white/[0.08] rounded-2xl text-[#F7F9FC] placeholder-[#98A2B3]/50 text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                  />
                </div>
                <span className="text-[10px] text-[#98A2B3] mt-1 block">
                  Telefon numaranızı veya ayarlarınızı güncellemek için kullanacaksınız.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#3B82F6] hover:to-[#2563EB] active:scale-[0.99] text-[#F7F9FC] font-semibold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Araç Oluşturuluyor...</span>
                  </>
                ) : (
                  <>
                    <span>Devam Et & Kartı Oluştur</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="w-full mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#98A2B3]">
              <span>Zaten bir aracınız var mı?</span>
              <Link href="/admin" className="text-[#3B82F6] hover:text-[#60A5FA] font-medium transition-colors">
                Giriş Yap →
              </Link>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ADIM 2: TELEGRAM BİLDİRİMLERİ (İSTEĞE BAĞLI)                  */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
            {/* Header Emblem */}
            <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
              <Bot className="w-7 h-7 text-[#0088cc]" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-[#F7F9FC] mb-1.5">
              Telegram Bildirimleri
            </h1>
            <p className="text-xs text-[#98A2B3] max-w-[290px] mb-5 leading-relaxed">
              Karekodunuz okutulduğunda Telegram hesabınıza anında ücretsiz bildirim gelsin mi?
            </p>

            {/* Success state if connected */}
            {telegramConnected ? (
              <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex flex-col items-center gap-2 mb-4">
                <CheckCircle2 className="w-8 h-8" />
                <span className="font-semibold">Telegram Başarıyla Bağlandı!</span>
                <span className="text-xs text-emerald-400/80">Karekod kartınız yükleniyor...</span>
              </div>
            ) : (
              <>
                {/* Bot Error */}
                {botError && (
                  <div className="w-full mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{botError}</span>
                  </div>
                )}

                {!showBotSetup ? (
                  <div className="w-full flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBotSetup(true)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#0088cc]/20"
                    >
                      <Bot className="w-4 h-4" />
                      <span>Telegram Botumu Bağla</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#0E131C] border border-white/[0.08] hover:bg-white/[0.04] text-[#98A2B3] hover:text-[#F7F9FC] font-medium text-sm transition-all"
                    >
                      <span>Şimdilik Atla / Sonra Kuracağım</span>
                    </button>

                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-left text-[11px] text-[#98A2B3] flex items-start gap-2 mt-2">
                      <Sparkles className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                      <span>
                        Telegram kurmasanız bile arayanlar size telefon ve WhatsApp ile doğrudan ulaşabilir. İstediğiniz zaman yönetim panelinizden de bağlayabilirsiniz.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-4 text-left">
                    {!pairingDeepLink ? (
                      <form onSubmit={handleConnectBot} className="flex flex-col gap-3">
                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-[#98A2B3] flex flex-col gap-1.5">
                          <span className="font-medium text-[#F7F9FC]">Telegram Botu Nasıl Alınır?</span>
                          <span>1. Telegram&apos;da <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#3B82F6] underline">@BotFather</a>&apos;ı açın.</span>
                          <span>2. <code className="text-[#60A5FA]">/newbot</code> yazıp bot adını belirleyin.</span>
                          <span>3. Verilen <code className="text-[#60A5FA]">API Token</code> kodunu aşağıya yapıştırın:</span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider mb-1">
                            Telegram Bot Token
                          </label>
                          <input
                            type="text"
                            value={botTokenInput}
                            onChange={(e) => setBotTokenInput(e.target.value)}
                            placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                            className="w-full px-3.5 py-3 bg-[#0E131C] border border-white/[0.08] rounded-2xl text-[#F7F9FC] placeholder-[#98A2B3]/50 text-xs font-mono focus:outline-none focus:border-[#3B82F6] transition-colors"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={botTesting}
                          className="w-full py-3 px-4 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {botTesting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Doğrulanıyor...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Token&apos;ı Doğrula & Devam Et</span>
                            </>
                          )}
                        </button>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="p-3.5 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 text-xs text-[#F7F9FC] flex flex-col gap-1">
                          <span className="font-semibold text-[#60A5FA]">@{botUsername} Botunuz Hazır!</span>
                          <span className="text-[#98A2B3]">
                            Aşağıdaki butona dokunarak Telegram&apos;da botunuzu başlatın, ardından &quot;Bağlantıyı Doğrula&quot;ya basın.
                          </span>
                        </div>

                        <a
                          href={pairingDeepLink}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3.5 px-4 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#0088cc]/20"
                        >
                          <Bot className="w-4 h-4" />
                          <span>Telegram&apos;da Botu Başlat (1. Adım)</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={handleVerifyPairing}
                          disabled={pairingVerifying}
                          className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {pairingVerifying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Kontrol Ediliyor...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Bağlantıyı Doğrula (2. Adım)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="w-full mt-1 text-center text-xs text-[#98A2B3] hover:text-[#F7F9FC] py-2 transition-colors"
                    >
                      Şimdilik bu adımı atla →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ADIM 3: KART HAZIR - ÖNİZLEME VE İNDİRME                       */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && createdSlug && (
          <div className="w-full flex flex-col items-center gap-4">
            {/* Success Banner */}
            <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[24px] p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[#F7F9FC]">{confirmedName}</div>
                  <div className="text-[11px] font-mono text-[#98A2B3]">
                    {confirmedPhone} • <span className="text-[#3B82F6]">{createdSlug}</span>
                  </div>
                </div>
              </div>

              <Link
                href={`/admin/${createdSlug}`}
                className="px-3 py-1.5 rounded-xl bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-xs font-semibold text-[#60A5FA] transition-colors"
              >
                Yönetim →
              </Link>
            </div>

            {/* Official QR Card Designer with Downloads */}
            <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-5 sm:p-6 shadow-2xl flex flex-col items-center">
              <QRCardDesigner
                slug={createdSlug}
                initialPhone={confirmedPhone}
                initialDisplayName={confirmedName}
              />
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="w-full flex flex-col sm:flex-row items-center gap-3">
              <Link
                href={`/admin/${createdSlug}`}
                className="w-full flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#3B82F6] hover:to-[#2563EB] text-[#F7F9FC] font-semibold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Shield className="w-4 h-4" />
                <span>Yönetim Paneline Git</span>
              </Link>

              <Link
                href={`/c/${createdSlug}`}
                target="_blank"
                className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-[#0E131C] border border-white/[0.08] hover:bg-white/[0.04] text-[#98A2B3] hover:text-[#F7F9FC] font-medium text-xs flex items-center justify-center gap-2 transition-all"
              >
                <span>Kartı Önizle</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
