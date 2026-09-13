"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Car,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  HelpCircle,
  X,
  Send,
  Lock,
} from "lucide-react";
import { setStoredOwnerSlug } from "@/lib/useOwnerSlug";

export default function AdminLoginPage() {
  const router = useRouter();

  // Login Form States
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Recent vehicle on this device
  const [recentSlug] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("numaratik_owner_slug");
        return stored && stored !== "arac" ? stored : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotSlug, setForgotSlug] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotNewPassConfirm, setForgotNewPassConfirm] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotSuccess, setForgotSuccess] = useState(null);
  const [forgotMethod, setForgotMethod] = useState("telegram");

  // Handle Login Submit
  const handleLogin = async (e) => {
    e?.preventDefault();
    setError(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setError("Lütfen araç plakanızı, telefon numaranızı veya araç adınızı girin.");
      return;
    }

    if (!cleanPass) {
      setError("Lütfen yönetim şifrenizi girin.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanId, password: cleanPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data?.error || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
        setLoading(false);
        return;
      }

      // Save to localStorage for automatic recognition
      if (data.slug) {
        setStoredOwnerSlug(data.slug);
      }

      // Redirect to vehicle dashboard
      router.push(data.redirectUrl || `/admin/${data.slug}`);
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  // Forgot Password Step 1: Request Code
  const handleForgotRequest = async (e) => {
    e?.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const cleanPhone = forgotPhone.trim();
    if (!cleanPhone) {
      setForgotError("Lütfen sisteme kayıtlı telefon numaranızı girin.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch("/api/admin/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, slug: forgotSlug || undefined }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setForgotMethod(data.method);
        if (data.slug) setForgotSlug(data.slug);
        setForgotStep(2);
        setForgotSuccess(data.message);
      } else {
        setForgotError(data?.error || "Kod gönderilemedi. Bilgilerinizi kontrol edin.");
      }
    } catch {
      setForgotError("Sunucuya bağlanılamadı.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password Step 2: Confirm Reset
  const handleForgotConfirm = async (e) => {
    e?.preventDefault();
    setForgotError(null);

    if (!forgotCode.trim()) {
      setForgotError("Lütfen güvenlik kodunu girin.");
      return;
    }

    if (forgotNewPass.trim().length < 6) {
      setForgotError("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (forgotNewPass.trim() !== forgotNewPassConfirm.trim()) {
      setForgotError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch("/api/admin/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: forgotSlug,
          code: forgotCode.trim(),
          newPassword: forgotNewPass.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setShowForgotModal(false);
        setPassword(forgotNewPass.trim());
        if (forgotSlug) {
          setIdentifier(forgotSlug);
          setStoredOwnerSlug(forgotSlug);
        }
        setError(null);
        alert("Şifreniz başarıyla güncellendi! Şimdi yeni şifrenizle giriş yapabilirsiniz.");
      } else {
        setForgotError(data?.error || "Şifre sıfırlanamadı.");
      }
    } catch {
      setForgotError("Sunucuya bağlanılamadı.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center p-4 relative selection:bg-blue-500/20 overflow-x-hidden">
      {/* Subtle Background Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[360px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/10 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
        {/* Logo Emblem */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0E131C] border border-blue-500/20 shadow-xl shadow-blue-500/5 mb-3.5 text-blue-400">
            <Car className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Araç Yönetim Paneli</h1>
          <p className="text-xs text-[#98A2B3] mt-1">
            Plakanız, telefon numaranız veya araç adınızla giriş yapın
          </p>
        </div>

        {/* Quick Return Option if already recognized */}
        {recentSlug && (
          <div className="w-full mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-[#98A2B3] truncate">
                Son kullanılan: <strong className="text-white font-mono">{recentSlug}</strong>
              </span>
            </div>
            <Link
              href={`/admin/${recentSlug}`}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] whitespace-nowrap transition-all shadow-sm shadow-blue-500/20"
            >
              Doğrudan Aç →
            </Link>
          </div>
        )}

        {/* Login Form Card */}
        <div className="w-full bg-[#0E131C]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Input 1: Vehicle Identifier */}
            <div>
              <label className="block text-xs font-semibold text-[#98A2B3] uppercase tracking-wider mb-2">
                Plaka, Telefon veya Araç Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#667085]">
                  <Car className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Örn: 34 ABC 123 veya 05XX XXX XX XX"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-[#141A24] border border-white/[0.08] rounded-xl text-white placeholder-[#667085] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                />
              </div>
            </div>

            {/* Input 2: Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#98A2B3] uppercase tracking-wider">
                  Yönetim Şifresi
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotError(null);
                    setForgotSuccess(null);
                    setForgotStep(1);
                    if (identifier && identifier.startsWith("05")) {
                      setForgotPhone(identifier);
                    }
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                >
                  Şifremi Unuttum?
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#667085]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-3 bg-[#141A24] border border-white/[0.08] rounded-xl text-white placeholder-[#667085] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#667085] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <span>Yönetim Paneline Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[11px] text-[#667085] uppercase tracking-wider font-semibold">veya</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Create New Vehicle CTA */}
          <Link
            href="/yeni"
            className="w-full py-2.5 px-4 rounded-xl bg-[#141A24] hover:bg-[#1A2230] border border-white/[0.08] text-[#F7F9FC] text-xs font-medium flex items-center justify-center gap-2 transition-colors text-center"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Yeni Bir Araç Kaydı Oluştur</span>
          </Link>
        </div>

        {/* Footer info & Master shortcut */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#667085]">
          <Link href="/patron" className="hover:text-[#98A2B3] transition-colors flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Patron Paneli</span>
          </Link>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-[#667085] hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Yönetim Şifresi Sıfırlama</h3>
                <p className="text-xs text-[#98A2B3]">
                  {forgotStep === 1
                    ? "Kayıtlı telefonunuza onay kodu gönderilecektir"
                    : "Onay kodunu ve yeni şifrenizi girin"}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#98A2B3] mb-1.5 font-medium">
                    Kayıtlı Telefon Numaranız
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-[#141A24] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#667085] focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#141A24] text-xs font-semibold text-[#98A2B3] hover:text-white"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Güvenlik Kodu Gönder</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotConfirm} className="space-y-3.5">
                <div>
                  <label className="block text-xs text-[#98A2B3] mb-1.5 font-medium">
                    {forgotMethod === "telegram"
                      ? "Telegram'a Gönderilen 6 Haneli Kod"
                      : "Kurtarma Kodu (RC-...)"}
                  </label>
                  <input
                    type="text"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder={forgotMethod === "telegram" ? "123456" : "RC-ABC123"}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-[#141A24] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#667085] focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono tracking-widest text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#98A2B3] mb-1.5 font-medium">
                    Yeni Yönetim Şifresi
                  </label>
                  <input
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="En az 6 karakter"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#141A24] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#667085] focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#98A2B3] mb-1.5 font-medium">
                    Yeni Şifreyi Tekrar Edin
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassConfirm}
                    onChange={(e) => setForgotNewPassConfirm(e.target.value)}
                    placeholder="Şifreyi tekrar yazın"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#141A24] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#667085] focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs text-[#98A2B3] hover:text-white"
                  >
                    ← Geri Dön
                  </button>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span>Şifreyi Güncelle</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
