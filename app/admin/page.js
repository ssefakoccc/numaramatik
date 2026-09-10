'use client';

import { useState } from 'react';
import { Lock, Phone, KeyRound, Shield, CheckCircle2, AlertCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [phone, setPhone] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success' | 'error', message: string }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, secretKey }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          type: 'success',
          message: 'Telefon numarası başarıyla güncellendi! Yeni numara artık QR taramalarında geçerli.',
        });
        setPhone('');
        setSecretKey('');
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Şifre hatalı veya işlem gerçekleştirilemedi.',
        });
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: 'Sunucuya bağlanırken bir hata oluştu.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Ambient Mesh Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        
        {/* Back link */}
        <Link
          href="/"
          className="self-start mb-6 inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors glass-pill px-3 py-1.5 rounded-full"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kullanıcı Sayfasına Dön</span>
        </Link>

        {/* Central Glass Card */}
        <div className="w-full glass-card rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center relative overflow-hidden">
          
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          {/* Admin Icon Badge */}
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-emerald-400 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-zinc-950 rounded-full p-1 border-2 border-zinc-900">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Yönetim Paneli
          </h1>
          <p className="text-zinc-400 text-xs text-center mb-6">
            QR kodunuzun yönlendireceği aktif telefon numarasını güncelleyin.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 px-1">
                Yeni Telefon Numarası
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  placeholder="+90 5XX XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 px-1">
                Admin Şifresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  placeholder="Gizli admin şifreniz"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>NUMARAYI GÜNCELLE</span>
                </>
              )}
            </button>
          </form>

          {result && (
            <div
              className={`w-full mt-4 p-3.5 rounded-2xl border flex items-start gap-3 text-xs text-left animate-float ${
                result.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              {result.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{result.message}</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
