'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Phone,
  MessageSquare,
  ShieldCheck,
  BellRing,
  Car,
  AlertTriangle,
  Copy,
  Check,
  Send,
  Sparkles,
  Lock,
  ChevronRight,
  Flame,
  Radio,
  Clock
} from 'lucide-react';

export default function CarPage() {
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notified, setNotified] = useState(false);
  const [emergencySending, setEmergencySending] = useState(false);
  const [emergencySent, setEmergencySent] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('Merhaba, aracınızın yanındayım.');
  const [customText, setCustomText] = useState('');
  const [scanTime, setScanTime] = useState('');

  const quickMessages = [
    {
      id: 'move',
      icon: '🚗',
      label: 'Aracı Çeker misiniz?',
      text: 'Merhaba, aracınızın yanındayım. Çıkış yapabilmem için aracınızı rica etsem çekebilir misiniz?',
    },
    {
      id: 'window',
      icon: '⚠️',
      label: 'Cam / Far Açık',
      text: 'Merhaba, aracınızın camı / farı açık kalmış gibi görünüyor, haber vermek istedim.',
    },
    {
      id: 'alarm',
      icon: '🔊',
      label: 'Alarm Çalıyor',
      text: 'Merhaba, aracınızın alarmı çalıyor, bilginiz olsun.',
    },
    {
      id: 'emergency',
      icon: '🚨',
      label: 'Acil Durum',
      text: '🚨 ACİL DURUM: Aracınızın başındayım, lütfen en kısa sürede iletişime geçiniz!',
    },
  ];

  useEffect(() => {
    const timeString = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setScanTime(timeString);

    async function init() {
      try {
        // 1. Supabase'den telefon numarasını çek
        const { data } = await supabase
          .from('vehicle_card')
          .select('phone_number')
          .eq('slug', 'arac')
          .single();

        if (data?.phone_number) {
          setPhone(data.phone_number);
        }
      } catch (err) {
        console.error('Veri çekilemedi:', err);
      } finally {
        setLoading(false);
      }

      // 2. Sayfa ilk açıldığında otomatik Telegram bildirimi ilet
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAgent: navigator.userAgent,
            type: 'scan',
          }),
        });
        setNotified(true);
      } catch (e) {
        console.error('Bildirim gönderilemedi:', e);
      }
    }

    init();
  }, []);

  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const waPhone = cleanPhone.replace('+', '');
  const activeMessage = customText || selectedMessage;

  const handleCopy = () => {
    if (!cleanPhone) return;
    navigator.clipboard.writeText(cleanPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendUrgentSignal = async () => {
    if (emergencySending || emergencySent) return;
    setEmergencySending(true);
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAgent: `${navigator.userAgent} [ACİL BUTON TIKLANDI]`,
        }),
      });
      setEmergencySent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setEmergencySending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 text-zinc-400 relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-emerald-400 animate-float shadow-2xl">
            <Car className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium tracking-wide">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Araç sahibi bilgileri yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Ambient Mesh Glow Background */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md my-auto flex flex-col items-center relative z-10">
        
        {/* Top Floating Pill: Live Status Badge */}
        <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-pill text-xs font-medium text-emerald-300 shadow-lg shadow-emerald-950/40 animate-float">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Sürücüye Anlık Bildirim İletildi</span>
          {scanTime && (
            <span className="text-zinc-500 border-l border-zinc-700 pl-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {scanTime}
            </span>
          )}
        </div>

        {/* Central Glassmorphic Card */}
        <div className="w-full glass-card rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Subtle Top Accent Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

          {/* Holographic Avatar Icon */}
          <div className="relative mb-5 group">
            <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-md opacity-40 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative w-20 h-20 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Car className="w-10 h-10 transform group-hover:scale-110 transition duration-300" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-zinc-950 rounded-full p-1 border-2 border-zinc-900 shadow-md">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Araç Sürücüsü
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-6 max-w-xs">
            Aracın konumu, park durumu veya acil durumlar için sürücüyle tek dokunuşla iletişime geçin.
          </p>

          {/* PRIMARY ACTION BUTTON: Direct Call */}
          <a
            href={cleanPhone ? `tel:${cleanPhone}` : '#'}
            className="w-full relative group overflow-hidden rounded-2xl p-[1px] mb-3 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-emerald-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 rounded-2xl transition-all duration-300 group-hover:opacity-100 opacity-90" />
            <div className="relative w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-3">
              {/* Shimmer effect */}
              <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 animate-shimmer pointer-events-none" />
              <Phone className="w-5 h-5 fill-current" />
              <span className="text-base tracking-wide font-black">SÜRÜCÜYÜ ARA</span>
            </div>
          </a>

          {/* SECONDARY ACTION BUTTON: WhatsApp Quick Send */}
          <a
            href={waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(activeMessage)}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-6 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 hover:border-emerald-500/50 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] shadow-md group mb-6"
          >
            <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>WhatsApp ile Mesaj Gönder</span>
          </a>

          {/* QUICK MESSAGE SELECTOR CHIPS */}
          <div className="w-full text-left mb-6">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Hazır Mesaj Seçin
              </span>
              <span className="text-[10px] text-zinc-500">Tek tıkla WhatsApp mesajı</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickMessages.map((msg) => {
                const isSelected = selectedMessage === msg.text && !customText;
                return (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg.text);
                      setCustomText('');
                    }}
                    className={`p-2.5 rounded-xl text-left text-xs transition-all flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-950'
                        : 'bg-zinc-900/60 hover:bg-zinc-800/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className="text-base">{msg.icon}</span>
                    <span className="font-semibold line-clamp-1">{msg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* EMERGENCY HIGH-PRIORITY BUZZER */}
          <div className="w-full bg-rose-950/20 border border-rose-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-300">Acil Flaş Bildirim</h4>
                <p className="text-[11px] text-zinc-400">Sürücüye yüksek öncelikli uyarı iletir</p>
              </div>
            </div>

            <button
              onClick={handleSendUrgentSignal}
              disabled={emergencySending || emergencySent}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                emergencySent
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95 shadow-md shadow-rose-950'
              }`}
            >
              {emergencySending ? 'İletiliyor...' : emergencySent ? '✓ İletildi' : 'Uyar 🚨'}
            </button>
          </div>

          {/* COPY NUMBER & SMS UTILITY ROW */}
          <div className="w-full flex items-center justify-between pt-5 mt-5 border-t border-zinc-800/80 text-xs text-zinc-400">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-zinc-800/50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Numara Kopyalandı!' : 'Numarayı Kopyala'}</span>
            </button>

            <a
              href={cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(activeMessage)}` : '#'}
              className="flex items-center gap-1.5 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-zinc-800/50"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>SMS Gönder</span>
            </a>
          </div>
        </div>

        {/* VIRAL HOOK CARD: "Kendi Aracın İçin Al" */}
        <div className="w-full mt-4 glass-card rounded-2xl p-4 flex items-center justify-between border border-emerald-500/20 bg-gradient-to-r from-zinc-900/90 via-emerald-950/20 to-zinc-900/90">
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Kendi Aracınız İçin İster Misiniz?</p>
              <p className="text-[10px] text-zinc-400">Akıllı QR İletişim Kartı edinin</p>
            </div>
          </div>
          <a
            href={waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent('Merhaba, ben de aracıma bu akıllı QR Numaratik sisteminden almak istiyorum. Bilgi alabilir miyim?')}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-xs rounded-xl border border-emerald-500/30 flex items-center gap-1 transition-all active:scale-95"
          >
            <span>İncele</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* FOOTER */}
        <footer className="mt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-600">
          <span>Numaratik • Güvenli Araç İletişim Ağı</span>
          <span>•</span>
          <a href="/admin" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
            <Lock className="w-3 h-3" /> Yönetici
          </a>
        </footer>
      </div>
    </main>
  );
}
