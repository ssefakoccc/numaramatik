'use client';

import { Phone, MessageSquare, Send, Copy, Check } from 'lucide-react';
import { getTelLink, getWhatsAppLink, getSmsLink } from '@/lib/phone';

export default function ContactActions({
  phone,
  message,
  copied,
  onCopy,
  disabled = false,
}) {
  const telLink = phone ? getTelLink(phone) : null;
  const waLink = phone ? getWhatsAppLink(phone, message) : null;
  const smsLink = phone ? getSmsLink(phone, message) : null;

  return (
    <section className="w-full flex flex-col gap-2.5 my-4" aria-label="İletişim Seçenekleri">
      {/* Primary Action: Call */}
      {telLink && !disabled ? (
        <a
          href={telLink}
          className="w-full h-12 px-6 rounded-2xl bg-[#F7F9FC] hover:bg-white text-[#05070B] font-medium text-sm flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] shadow-sm select-none"
        >
          <Phone className="w-4 h-4 fill-current stroke-none" />
          <span>Sürücüyü Ara</span>
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full h-12 px-6 rounded-2xl bg-white/10 text-white/40 font-medium text-sm flex items-center justify-center gap-2.5 cursor-not-allowed select-none"
        >
          <Phone className="w-4 h-4 fill-current stroke-none" />
          <span>Sürücüyü Ara</span>
        </button>
      )}

      {/* Secondary Action: WhatsApp */}
      {waLink && !disabled ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 px-6 rounded-2xl bg-[#0E131C] hover:bg-[#141A24] border border-white/[0.08] hover:border-white/[0.16] text-[#F7F9FC] font-medium text-sm flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] select-none"
        >
          <MessageSquare className="w-4 h-4 text-[#60A5FA]" />
          <span>WhatsApp ile İletişim</span>
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full h-12 px-6 rounded-2xl bg-[#0E131C]/50 border border-white/[0.04] text-white/30 font-medium text-sm flex items-center justify-center gap-2.5 cursor-not-allowed select-none"
        >
          <MessageSquare className="w-4 h-4 text-white/30" />
          <span>WhatsApp ile İletişim</span>
        </button>
      )}

      {/* Secondary Utility Row: SMS & Copy Number */}
      <div className="w-full grid grid-cols-2 gap-2 pt-1">
        {/* SMS Button */}
        {smsLink && !disabled ? (
          <a
            href={smsLink}
            className="h-10 px-3 rounded-xl bg-[#0E131C] hover:bg-[#141A24] border border-white/[0.06] text-xs font-medium text-[#98A2B3] hover:text-[#F7F9FC] flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SMS Gönder</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="h-10 px-3 rounded-xl bg-[#0E131C]/40 border border-white/[0.04] text-xs font-medium text-white/30 flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SMS Gönder</span>
          </button>
        )}

        {/* Copy Button */}
        <button
          type="button"
          onClick={onCopy}
          disabled={!phone || disabled}
          aria-label={copied ? 'Telefon numarası kopyalandı' : 'Telefon numarasını panoya kopyala'}
          className="h-10 px-3 rounded-xl bg-[#0E131C] hover:bg-[#141A24] border border-white/[0.06] text-xs font-medium text-[#98A2B3] hover:text-[#F7F9FC] flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span className="text-[#60A5FA]">Kopyalandı</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Numarayı Kopyala</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
