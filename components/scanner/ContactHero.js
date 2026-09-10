'use client';

import { Car, Phone } from 'lucide-react';
import { formatDisplayPhone, getTelLink } from '@/lib/phone';

export default function ContactHero({ phone, loading }) {
  const displayPhone = phone ? formatDisplayPhone(phone) : null;
  const telLink = phone ? getTelLink(phone) : null;

  return (
    <header className="w-full flex flex-col items-center text-center">
      {/* Wordmark and status pill */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E131C] border border-white/[0.08] text-[11px] font-medium text-[#98A2B3] mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" aria-hidden="true" />
        <span className="tracking-widest uppercase text-[10px] text-[#F7F9FC] font-semibold">NUMARATİK</span>
        <span className="text-white/20">•</span>
        <span>Araç sahibiyle iletişim</span>
      </div>

      {/* Product emblem */}
      <div className="w-16 h-16 rounded-2xl bg-[#0E131C] border border-white/[0.08] shadow-lg flex items-center justify-center text-[#F7F9FC] mb-4">
        <Car className="w-7 h-7 text-[#98A2B3] stroke-[1.75]" />
      </div>

      {/* Main Title & Description */}
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F7F9FC] mb-1.5">
        Araç sahibine ulaşın
      </h1>
      <p className="text-xs sm:text-sm text-[#98A2B3] max-w-[320px] leading-relaxed mb-4">
        Park veya araçla ilgili bir durum için aşağıdaki seçeneklerden biriyle iletişim kurabilirsiniz.
      </p>

      {/* Formatted Phone Display */}
      {loading ? (
        <div className="h-8 w-44 bg-white/[0.05] rounded-lg animate-pulse mb-2" />
      ) : displayPhone ? (
        <a
          href={telLink}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0E131C] border border-white/[0.08] hover:border-white/20 text-sm font-mono font-medium text-[#F7F9FC] tracking-wider transition-colors active:scale-[0.98]"
          title="Numarayı doğrudan ara"
        >
          <Phone className="w-3.5 h-3.5 text-[#60A5FA]" />
          <span>{displayPhone}</span>
        </a>
      ) : null}
    </header>
  );
}
