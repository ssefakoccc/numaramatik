'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import ContactHero from '@/components/scanner/ContactHero';
import ContactActions from '@/components/scanner/ContactActions';
import QuickMessages, { SCENARIOS } from '@/components/scanner/QuickMessages';
import { AlertCircle, RotateCcw, Shield, ChevronRight } from 'lucide-react';
import { normalizePhoneNumber } from '@/lib/phone';

import { useOwnerSlug } from '@/lib/useOwnerSlug';

export default function ScannerPage() {
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(SCENARIOS[0].text);
  const activeAbortRef = useRef(null);

  const ownerSlug = useOwnerSlug();
  const isOwner = ownerSlug === 'arac';

  // Single, reliable phone data fetcher
  const fetchPhoneData = useCallback(async (isRetry = false) => {
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }

    const controller = new AbortController();
    activeAbortRef.current = controller;

    if (isRetry) {
      await Promise.resolve();
      setLoading(true);
      setError(null);
      setPhone(null);
    }

    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch('/api/phone', {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const validPhone = normalizePhoneNumber(data?.phoneNumber);

      if (res.ok && data?.success && validPhone) {
        setPhone(validPhone);
        setError(null);
      } else {
        setPhone(null);
        setError('İletişim bilgisine şu anda ulaşılamıyor.');
      }
    } catch {
      clearTimeout(timeoutId);
      setPhone(null);
      setError('İletişim bilgisine şu anda ulaşılamıyor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchPhoneData(false);
    })();

    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
    };
  }, [fetchPhoneData]);

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
    } catch {}
  };

  const handleScenarioSelect = useCallback((text, title) => {
    setSelectedMessage(text);
    if (!title) return;

    try {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scenario',
          reason: title,
          slug: 'arac',
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, []);

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col justify-between items-center px-4 py-6 sm:p-8 relative overflow-x-hidden">
      {/* Instant Early Scan Notification Trigger */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{if(window.location.pathname!=='/')return;if(sessionStorage.getItem('numaratik_scan_notified')==='1')return;if(window.__numaratik_scanning)return;window.__numaratik_scanning=true;function sendScan(canRetry){fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'scan',slug:'arac'}),keepalive:true}).then(function(res){return res.json().then(function(data){return{ok:res.ok,data:data};}).catch(function(){return{ok:res.ok,data:null};});}).then(function(result){if(result.ok&&result.data&&result.data.success===true){try{sessionStorage.setItem('numaratik_scan_notified','1');}catch(e){}}else if(canRetry){setTimeout(function(){sendScan(false);},1500);}}).catch(function(){if(canRetry){setTimeout(function(){sendScan(false);},1500);}});}sendScan(true);}catch(e){}})();`,
        }}
      />
      {/* Subtle radial spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.05] via-[#141A24]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Container */}
      <div className="w-full max-w-[400px] my-auto flex flex-col items-center relative z-10">
        {/* Owner Banner (if scanned on owner's device) */}
        {isOwner && (
          <div className="w-full mb-3 px-4 py-2.5 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#60A5FA]" />
              <span className="text-xs font-medium text-[#F7F9FC]">Bu araç sizin cihazınızda kayıtlı</span>
            </div>
            <Link
              href="/admin"
              className="text-xs font-semibold text-[#60A5FA] hover:text-[#93C5FD] transition-colors flex items-center gap-0.5"
            >
              <span>Yönetim</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

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
                onClick={() => fetchPhoneData(true)}
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
              onSelect={handleScenarioSelect}
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
