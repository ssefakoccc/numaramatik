'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Phone,
  MessageCircle,
  Car,
  Copy,
  Check,
  Send,
  Sparkles,
  Lock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import Link from 'next/link';

export default function CarPage() {
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('Merhaba, aracınızın yanındayım.');

  const quickScenarios = [
    {
      id: 'move',
      emoji: '🚗',
      title: 'Araç Çekme Talebi',
      text: 'Merhaba, aracınızın yanındayım. Çıkış yapabilmem için aracınızı rica etsem çekebilir misiniz?',
    },
    {
      id: 'window',
      emoji: '⚠️',
      title: 'Cam / Far Açık',
      text: 'Merhaba, aracınızın camı veya farı açık kalmış, bilgi vermek istedim.',
    },
    {
      id: 'parking',
      emoji: '🅿️',
      title: 'Hatalı Park / Engel',
      text: 'Merhaba, aracınız park alanında geçişi engelliyor, kısa bir süre için yardımcı olabilir misiniz?',
    },
    {
      id: 'urgent',
      emoji: '⚡',
      title: 'Acil İletişim',
      text: 'Önemli: Aracınızın başındayım, lütfen görür görmez arayabilir misiniz?',
    },
  ];

  useEffect(() => {
    async function init() {
      try {
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

      // Arka planda sessizce bildirim gönder
      try {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAgent: navigator.userAgent,
          }),
        });
      } catch (e) {
        // Sessiz hata yakalama
      }
    }

    init();
  }, []);

  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const waPhone = cleanPhone.replace('+', '');

  const handleCopy = () => {
    if (!cleanPhone) return;
    navigator.clipboard.writeText(cleanPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6 text-[#86868b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#1c1c1e] border-t-[#f5f5f7] animate-spin" />
          <span className="text-xs font-medium tracking-wide">Numaratik</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-[#f5f5f7] flex flex-col items-center justify-between p-4 sm:p-6 select-none relative overflow-hidden font-sans">
      
      {/* Subtle Apple-style Ambient Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-white/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Box */}
      <div className="w-full max-w-[390px] my-auto flex flex-col items-center z-10 pt-4 pb-2">
        
        {/* Apple Dynamic Island Style Header Pill */}
        <div className="mb-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#1c1c1e]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-xs font-semibold tracking-tight text-[#f5f5f7]">Araç İletişim Kartı</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[#86868b] font-medium">Doğrulandı</span>
        </div>

        {/* Hero Card */}
        <div className="w-full bg-[#121214]/90 border border-white/[0.08] rounded-[36px] p-7 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center">
          
          {/* Apple Car Icon Emblem */}
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-b from-[#2c2c2e] to-[#1c1c1e] border border-white/[0.12] flex items-center justify-center text-white shadow-xl">
              <Car className="w-9 h-9 stroke-[1.75]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1.5">
            Araç Sürücüsü
          </h1>
          <p className="text-[#86868b] text-xs font-normal max-w-[260px] leading-relaxed mb-6">
            Park durumu veya doğrudan iletişim için aşağıdaki seçenekleri kullanabilirsiniz.
          </p>

          {/* PRIMARY ACTION: Call Driver (Apple Style) */}
          <a
            href={cleanPhone ? `tel:${cleanPhone}` : '#'}
            className="w-full py-4 px-6 bg-white hover:bg-[#e5e5e7] text-black font-semibold rounded-[20px] flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.97] shadow-lg shadow-white/5 mb-3"
          >
            <Phone className="w-5 h-5 fill-black stroke-none" />
            <span className="text-sm font-semibold tracking-tight">Sürücüyü Ara</span>
          </a>

          {/* SECONDARY ACTION: WhatsApp (Apple Dark Glass Style) */}
          <a
            href={waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(selectedMessage)}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-6 bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] text-white font-medium rounded-[20px] flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.97] mb-6"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold tracking-tight">WhatsApp ile Yaz</span>
          </a>

          {/* Apple Style Segmented Quick Message Selector */}
          <div className="w-full text-left mb-6">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-semibold text-[#86868b] tracking-wider uppercase">
                Hazır Mesaj Seçin
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickScenarios.map((item) => {
                const isSelected = selectedMessage === item.text;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedMessage(item.text)}
                    className={`p-3 rounded-[18px] text-left transition-all duration-200 flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-white/[0.12] border-white/30 text-white shadow-inner'
                        : 'bg-[#1c1c1e]/60 hover:bg-[#1c1c1e] border-white/[0.04] text-[#86868b]'
                    }`}
                  >
                    <span className="text-sm">{item.emoji}</span>
                    <span className="text-[11px] font-medium text-[#f5f5f7] line-clamp-1">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Utility Bar */}
          <div className="w-full pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#86868b]">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 hover:text-white transition-colors py-1.5 px-2.5 rounded-xl hover:bg-white/[0.04]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium">{copied ? 'Kopyalandı' : 'Numarayı Kopyala'}</span>
            </button>

            <a
              href={cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(selectedMessage)}` : '#'}
              className="flex items-center gap-1.5 hover:text-white transition-colors py-1.5 px-2.5 rounded-xl hover:bg-white/[0.04]"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">SMS Gönder</span>
            </a>
          </div>
        </div>

        {/* Apple Style Minimalist Promotion Banner */}
        <div className="w-full mt-3 bg-[#121214]/60 border border-white/[0.06] rounded-[24px] p-3.5 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-medium text-white">Aracınız İçin QR Kart</p>
              <p className="text-[9px] text-[#86868b]">Numaratik akıllı iletişim sistemi</p>
            </div>
          </div>
          <a
            href={waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent('Merhaba, ben de aracıma Numaratik akıllı QR kartvizitinden almak istiyorum.')}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.14] text-white text-[11px] font-medium rounded-full transition-all flex items-center gap-1"
          >
            <span>Bilgi Al</span>
            <ChevronRight className="w-3 h-3 text-[#86868b]" />
          </a>
        </div>

        {/* Minimal Footer */}
        <footer className="mt-5 flex items-center justify-center gap-3 text-[10px] text-[#555558]">
          <span>Numaratik</span>
          <span>•</span>
          <span>Gizlilik & Güvenlik</span>
          <span>•</span>
          <Link href="/admin" className="hover:text-[#86868b] transition-colors flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Admin
          </Link>
        </footer>
      </div>
    </main>
  );
}
