'use client';

import { useEffect, useState, useCallback } from 'react';
import ContactHero from '@/components/scanner/ContactHero';
import ContactActions from '@/components/scanner/ContactActions';
import QuickMessages, { SCENARIOS } from '@/components/scanner/QuickMessages';
import StatusToast from '@/components/ui/StatusToast';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { normalizePhoneNumber } from '@/lib/phone';

export default function ScannerPage() {
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(SCENARIOS[0].text);

  // Fetch active vehicle phone number
  const fetchPhoneData = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setLoading(true);
      setError(null);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch('/api/phone', {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data?.success && data?.phoneNumber) {
        setPhone(data.phoneNumber);
      } else {
        setError('İletişim bilgisine şu anda ulaşılamıyor.');
      }
    } catch {
      clearTimeout(timeoutId);
      setError('İletişim bilgisine şu anda ulaşılamıyor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      try {
        const res = await fetch('/api/phone', {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (!mounted) return;

        if (res.ok && data?.success && data?.phoneNumber) {
          setPhone(data.phoneNumber);
        } else {
          setError('İletişim bilgisine şu anda ulaşılamıyor.');
        }
      } catch {
        clearTimeout(timeoutId);
        if (mounted) {
          setError('İletişim bilgisine şu anda ulaşılamıyor.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // Fire silent notify once
      try {
        const alreadySent = sessionStorage.getItem('numaratik_scan_notified');
        if (!alreadySent) {
          sessionStorage.setItem('numaratik_scan_notified', 'true');
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userAgent: navigator.userAgent || 'Mobil Tarayıcı',
            }),
          }).catch(() => {});
        }
      } catch {}
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCopy = () => {
    if (!phone) return;
    const normalized = normalizePhoneNumber(phone) || phone;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(normalized)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        })
        .catch(() => {
          fallbackCopyText(normalized);
        });
    } else {
      fallbackCopyText(normalized);
    }
  };

  const fallbackCopyText = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy failed
    }
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col justify-between items-center px-4 py-6 sm:p-8 relative overflow-x-hidden">
      {/* Subtle radial spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.05] via-[#141A24]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Container */}
      <div className="w-full max-w-[400px] my-auto flex flex-col items-center relative z-10">
        
        {/* Card Surface */}
        <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[32px] p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
          
          {/* Header & Emblem */}
          <ContactHero phone={phone} loading={loading} />

          {/* Loading Skeleton */}
          {loading && (
            <div className="w-full flex flex-col gap-2.5 my-4" aria-busy="true">
              <div className="w-full h-12 bg-white/[0.05] rounded-2xl animate-pulse" />
              <div className="w-full h-12 bg-white/[0.03] rounded-2xl animate-pulse" />
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />
              </div>
            </div>
          )}

          {/* Error / Empty State */}
          {!loading && error && (
            <div className="w-full my-4 p-4 rounded-2xl bg-[#0E131C] border border-red-500/20 text-center flex flex-col items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-xs font-semibold text-[#F7F9FC]">{error}</p>
                <p className="text-[11px] text-[#98A2B3] mt-0.5">
                  Lütfen bağlantınızı kontrol edip tekrar deneyin.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPhoneData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-[#F7F9FC] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tekrar dene</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          {!loading && !error && (
            <ContactActions
              phone={phone}
              message={selectedMessage}
              copied={copied}
              onCopy={handleCopy}
              disabled={loading || !!error}
            />
          )}

          {/* Quick Scenario Messages */}
          {!loading && !error && (
            <QuickMessages
              selectedText={selectedMessage}
              onSelect={(text) => setSelectedMessage(text)}
            />
          )}
        </div>

        {/* Minimal Footer */}
        <footer className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#667085]">
          <span>Numaratik</span>
          <span>•</span>
          <span>Güvenli Araç İletişimi</span>
        </footer>
      </div>
    </main>
  );
}
