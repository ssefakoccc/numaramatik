'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CarPage() {
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // 1. Güncel numarayı çek
      const { data } = await supabase
        .from('vehicle_card')
        .select('phone_number')
        .eq('slug', 'arac')
        .single();

      if (data?.phone_number) {
        setPhone(data.phone_number);
      }
      setLoading(false);

      // 2. Sayfa yüklendiğinde anlık bildirim API'sini tetikle
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAgent: navigator.userAgent }),
      });
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Yükleniyor...
      </div>
    );
  }

  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 text-2xl border border-emerald-500/20">
          🚗
        </div>
        <h1 className="text-xl font-bold tracking-tight mb-2">Araç Sürücüsü</h1>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          Aracın konumu veya acil durum için aşağıdaki butonları kullanarak doğrudan iletişime geçebilirsiniz.
        </p>

        <div className="w-full space-y-3">
          <a
            href={`tel:${cleanPhone}`}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <span>📞</span> Sürücüyü Ara
          </a>

          <a
            href={`https://wa.me/${cleanPhone.replace('+', '')}?text=Merhaba,%20aracınızın%20yanındayım.`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-2xl flex items-center justify-center gap-3 border border-zinc-700/60 transition-all active:scale-95"
          >
            <span>💬</span> WhatsApp Mesajı Gönder
          </a>
        </div>
      </div>
    </main>
  );
}
