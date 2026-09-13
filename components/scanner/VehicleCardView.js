"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ContactHero from "@/components/scanner/ContactHero";
import ContactActions from "@/components/scanner/ContactActions";
import QuickMessages, { SCENARIOS } from "@/components/scanner/QuickMessages";
import { AlertCircle, RotateCcw } from "lucide-react";
import { normalizePhoneNumber } from "@/lib/phone";

export default function VehicleCardView({ slug = "arac" }) {
  const [phone, setPhone] = useState(null);
  const [displayName, setDisplayName] = useState("Araç");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUnactivated, setIsUnactivated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(SCENARIOS[0].text);
  const activeAbortRef = useRef(null);

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
      setIsUnactivated(false);
      setPhone(null);
    }

    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(`/api/phone?slug=${encodeURIComponent(slug)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const validPhone = normalizePhoneNumber(data?.phoneNumber);

      if (res.ok && data?.success && validPhone) {
        setPhone(validPhone);
        if (data.displayName) {
          setDisplayName(data.displayName);
        }
        setError(null);
        setIsUnactivated(false);
      } else {
        setPhone(null);
        if (data?.isActivated === false) {
          setIsUnactivated(true);
        }
        setError(data?.error || "İletişim bilgisine şu anda ulaşılamıyor.");
      }
    } catch {
      clearTimeout(timeoutId);
      setPhone(null);
      setError("İletişim bilgisine şu anda ulaşılamıyor.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const handleScenarioSelect = useCallback((text, title) => {
    setSelectedMessage(text);
    if (!title) return;

    try {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "scenario",
          reason: title,
          slug,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [slug]);

  const scriptCode = `(function(){try{var s=${JSON.stringify(slug)};var k='numaratik_scan_notified_'+s;if(sessionStorage.getItem(k)==='1')return;if(window['__numaratik_scanning_'+s])return;window['__numaratik_scanning_'+s]=true;function send(retry){fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'scan',slug:s}),keepalive:true}).then(function(res){return res.json().then(function(data){return{ok:res.ok,data:data};}).catch(function(){return{ok:res.ok,data:null};});}).then(function(r){if(r.ok&&r.data&&r.data.success===true){try{sessionStorage.setItem(k,'1');}catch(e){}}else if(retry){setTimeout(function(){send(false);},1500);}}).catch(function(){if(retry){setTimeout(function(){send(false);},1500);}});}send(true);}catch(e){}})();`;

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col justify-between items-center px-4 py-6 sm:p-8 relative overflow-x-hidden">
      {/* Instant Early Scan Notification Trigger */}
      <script dangerouslySetInnerHTML={{ __html: scriptCode }} />

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
          <ContactHero phone={phone} loading={loading} displayName={displayName} />

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

          {/* Unactivated State */}
          {!loading && isUnactivated && (
            <div className="w-full my-4 p-5 rounded-2xl bg-[#0E131C] border border-amber-500/20 text-center flex flex-col items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-[#F7F9FC]">Bu Araç Kartı Henüz Kurulmadı</h2>
              <p className="text-xs text-[#98A2B3] leading-relaxed max-w-[280px]">
                Bu kart sahibi tarafından henüz aktif edilmemiştir. Kart sahibiyseniz aktivasyon bağlantınız üzerinden kurulumu tamamlayabilirsiniz.
              </p>
            </div>
          )}

          {/* Error / Empty State */}
          {!loading && !isUnactivated && error && (
            <div className="w-full my-4 p-4 rounded-2xl bg-[#0E131C] border border-red-500/20 text-center flex flex-col items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-xs text-[#98A2B3] leading-relaxed">{error}</p>
              <button
                onClick={() => fetchPhoneData(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-[#F7F9FC] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tekrar Dene</span>
              </button>
            </div>
          )}

          {/* Actions & Scenarios */}
          {!loading && !error && phone && (
            <>
              <ContactActions
                phone={phone}
                copied={copied}
                onCopy={handleCopy}
                selectedMessage={selectedMessage}
              />
              <QuickMessages
                onSelectMessage={handleScenarioSelect}
                selectedMessage={selectedMessage}
              />
            </>
          )}
        </div>
      </div>

      {/* Footer / Privacy Assurance */}
      <footer className="w-full max-w-[400px] mt-8 text-center text-[11px] text-[#667085] flex flex-col items-center gap-1.5 z-10">
        <p>Numaratik • Güvenli ve Hızlı Araç İletişim Sistemi</p>
        <p className="text-[10px] text-[#667085]/70">
          Bu sayfada kişisel verileriniz kaydedilmez veya paylaşılmaz.
        </p>
      </footer>
    </main>
  );
}
