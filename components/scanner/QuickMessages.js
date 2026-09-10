'use client';

import { Car, AlertTriangle, ShieldAlert, Zap } from 'lucide-react';

export const SCENARIOS = [
  {
    id: 'move',
    icon: Car,
    title: 'Aracı çekebilir misiniz?',
    text: 'Merhaba, aracınızın yanındayım. Çıkış yapabilmem için aracınızı rica etsem çekebilir misiniz?',
  },
  {
    id: 'window',
    icon: AlertTriangle,
    title: 'Cam veya far açık',
    text: 'Merhaba, aracınızın camı veya farı açık kalmış, bilgi vermek istedim.',
  },
  {
    id: 'parking',
    icon: ShieldAlert,
    title: 'Geçiş engelleniyor',
    text: 'Merhaba, aracınız park alanında geçişi engelliyor, kısa bir süre için yardımcı olabilir misiniz?',
  },
  {
    id: 'urgent',
    icon: Zap,
    title: 'Acil iletişim',
    text: 'Önemli: Aracınızın başındayım, lütfen görür görmez arayabilir misiniz?',
  },
];

export default function QuickMessages({ selectedText, onSelect }) {
  return (
    <section className="w-full mt-3 text-left" aria-label="Hazır Durum Mesajları">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider">
          Hazır Durum Seçimi
        </h2>
        <span className="text-[10px] text-[#667085]">Mesajı otomatik doldurur</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedText === item.text;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.text, item.title)}
              aria-pressed={isSelected}
              className={`p-3 rounded-2xl text-left transition-all duration-150 flex flex-col gap-2 border ${
                isSelected
                  ? 'bg-[#141A24] border-[#3B82F6]/60 text-[#F7F9FC] ring-1 ring-[#3B82F6]/30 shadow-sm'
                  : 'bg-[#0E131C] hover:bg-[#141A24] border-white/[0.06] text-[#98A2B3] hover:text-[#F7F9FC]'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-[#3B82F6]/20 text-[#60A5FA]' : 'bg-white/[0.04] text-[#98A2B3]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 stroke-[2]" />
              </div>
              <span className="text-xs font-medium leading-snug line-clamp-2">
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
