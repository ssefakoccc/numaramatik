'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { formatDisplayPhone, normalizePhoneNumber } from '@/lib/phone';

function formatEventDate(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export default function AdminPage() {
  const [currentPhone, setCurrentPhone] = useState(null);
  const [newPhone, setNewPhone] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingCurrent, setFetchingCurrent] = useState(true);
  const [status, setStatus] = useState(null);

  // Son Hareketler states
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  const handleFetchEvents = async () => {
    setEventsError(null);
    if (!secretKey.trim()) {
      setEventsError('Lütfen yukarıdaki alana admin şifrenizi girin.');
      return;
    }

    setEventsLoading(true);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: secretKey.trim() }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setEvents(data.events || []);
        setEventsLoaded(true);
      } else {
        setEventsError(data?.error || 'Geçmiş yüklenemedi. Şifrenizi kontrol edin.');
      }
    } catch {
      setEventsError('Geçmiş yüklenirken bir hata oluştu.');
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const res = await fetch('/api/phone', { cache: 'no-store' });
        const data = await res.json();
        if (mounted && res.ok && data?.success && data?.phoneNumber) {
          setCurrentPhone(data.phoneNumber);
        }
      } catch {
        // Sessiz hata
      } finally {
        if (mounted) {
          setFetchingCurrent(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    const normalized = normalizePhoneNumber(newPhone);
    if (!normalized) {
      setStatus({
        type: 'error',
        message: 'Lütfen geçerli bir Türkiye cep telefonu girin (Örn: 0544 724 09 92).',
      });
      return;
    }

    if (!secretKey.trim()) {
      setStatus({
        type: 'error',
        message: 'Lütfen admin şifrenizi girin.',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, secretKey: secretKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setCurrentPhone(data.phoneNumber || normalized);
        setNewPhone('');
        setSecretKey('');
        setStatus({
          type: 'success',
          message: 'Telefon numarası başarıyla güncellendi. Yeni numara yayında.',
        });
      } else {
        setStatus({
          type: 'error',
          message: data?.error || 'Güncelleme başarısız oldu. Lütfen bilgilerinizi kontrol edin.',
        });
      }
    } catch {
      setStatus({
        type: 'error',
        message: 'Sunucuya bağlanırken bir hata oluştu.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">
      {/* Subtle background spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.04] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[390px] relative z-10 flex flex-col items-center">
        {/* Back Link */}
        <Link
          href="/"
          className="self-start mb-5 inline-flex items-center gap-1.5 text-xs text-[#98A2B3] hover:text-[#F7F9FC] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ana Sayfaya Dön</span>
        </Link>

        {/* Main Card */}
        <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
          {/* Emblem */}
          <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
            <Shield className="w-6 h-6 text-[#60A5FA]" />
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-[#F7F9FC] mb-1">
            Numara yönetimi
          </h1>
          <p className="text-xs text-[#98A2B3] max-w-[280px] leading-relaxed mb-5">
            QR kodunuzun yönlendirdiği aktif telefon numarasını güvenli şekilde güncelleyin.
          </p>

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
          <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
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
                  required
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
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Admin gizli şifreniz"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#0E131C] border border-white/[0.08] text-[#F7F9FC] placeholder-[#667085] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors text-sm"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#98A2B3] hover:text-[#F7F9FC]"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-1 rounded-2xl bg-[#F7F9FC] hover:bg-white text-[#05070B] font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <span>Numarayı güncelle</span>
              )}
            </button>
          </form>

        {/* Feedback Status */}
          {status && (
            <div
              role="alert"
              className={`w-full mt-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs text-left ${
                status.type === 'success'
                  ? 'bg-[#0E131C] border-[#3B82F6]/30 text-[#F7F9FC]'
                  : 'bg-[#1C1214] border-red-500/30 text-red-200'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{status.message}</div>
            </div>
          )}
        </div>

        {/* Son Hareketler (Activity History) Card */}
        <div className="w-full mt-4 bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl flex flex-col text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#60A5FA]">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[#F7F9FC]">
                  Son Hareketler
                </h2>
                <p className="text-[11px] text-[#98A2B3]">
                  Son 20 okutma ve bildirim kaydı
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchEvents}
              disabled={eventsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E131C] hover:bg-[#141A26] border border-white/[0.08] text-xs font-medium text-[#F7F9FC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {eventsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#60A5FA]" />
              ) : eventsLoaded ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#98A2B3]" />
              ) : null}
              <span>{eventsLoaded ? 'Yenile' : 'Geçmişi görüntüle'}</span>
            </button>
          </div>

          {/* Events Error */}
          {eventsError && (
            <div
              role="alert"
              className="mt-3 p-3 rounded-xl border bg-[#1C1214] border-red-500/30 text-red-200 flex items-start gap-2 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{eventsError}</div>
            </div>
          )}

          {/* Events Content Area */}
          <div className="mt-4">
            {eventsLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-[#98A2B3] text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#60A5FA]" />
                <span>Kayıtlar getiriliyor...</span>
              </div>
            ) : !eventsLoaded ? (
              <div className="py-6 px-3 rounded-2xl bg-[#0E131C]/60 border border-white/[0.04] text-center text-xs text-[#98A2B3]">
                Kayıtları listelemek için admin şifrenizi girip{' '}
                <span className="text-[#F7F9FC] font-medium">“Geçmişi görüntüle”</span> butonuna tıklayın.
              </div>
            ) : events.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#98A2B3]">
                Kayıtlı hareket bulunamadı.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {events.map((ev) => {
                  const isScan = ev.eventType === 'scan';
                  return (
                    <div
                      key={ev.id}
                      className="p-3 rounded-2xl bg-[#0E131C] border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                          {isScan ? (
                            <QrCode className="w-3.5 h-3.5 text-[#60A5FA]" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5 text-[#34D399]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#F7F9FC] truncate">
                            {isScan ? 'QR okutuldu' : ev.reason || 'Senaryo bildirimi'}
                          </p>
                          <p className="text-[11px] text-[#98A2B3] truncate">
                            {ev.deviceLabel || 'Bilinmiyor'}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono text-[#98A2B3] shrink-0 text-right whitespace-nowrap">
                        {formatEventDate(ev.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="mt-6 text-[11px] text-[#667085]">
          <span>Numaratik Yönetim Konsolu</span>
        </footer>
      </div>
    </main>
  );
}
