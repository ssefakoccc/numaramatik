'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function StatusToast({ type = 'success', message, onClose }) {
  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full p-3 rounded-xl border flex items-start gap-2.5 text-xs text-left transition-opacity duration-200 ${
        isSuccess
          ? 'bg-[#0E131C] border-[#3B82F6]/30 text-[#F7F9FC]'
          : 'bg-[#1C1214] border-red-500/30 text-red-200'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 leading-relaxed font-normal">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs px-1"
          aria-label="Kapat"
        >
          ✕
        </button>
      )}
    </div>
  );
}
