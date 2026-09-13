"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminCardView from "@/components/admin/AdminCardView";
import { Loader2, PlusCircle, Shield, ArrowRight, Car, KeyRound } from "lucide-react";
import Link from "next/link";
import { useOwnerSlug, setStoredOwnerSlug } from "@/lib/useOwnerSlug";

export default function AdminPage() {
  const router = useRouter();
  const ownerSlug = useOwnerSlug();
  const [inputSlug, setInputSlug] = useState("");
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("switch") === "1") return;
      if (ownerSlug && ownerSlug !== "arac") {
        router.replace(`/admin/${ownerSlug}`);
      }
    } catch {}
  }, [ownerSlug, router]);

  const isSwitch = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("switch") === "1";

  // If this device has an assigned card and not in switch mode, redirect
  if (ownerSlug && ownerSlug !== "arac" && !isSwitch) {
    return (
      <main className="min-h-screen bg-[#05070B] flex items-center justify-center text-[#F7F9FC]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
          <span className="text-xs text-[#98A2B3]">Yönetim paneli yükleniyor...</span>
        </div>
      </main>
    );
  }

  // If already identified as 'arac' and not explicitly switching, show 'arac'
  if (ownerSlug === "arac" && !isSwitch) {
    return <AdminCardView slug="arac" />;
  }

  // Gateway screen for new visitors or users wanting to switch / register new vehicle
  const handleGoToSlug = (e) => {
    e?.preventDefault();
    const clean = inputSlug.trim().toLowerCase();
    if (!clean) {
      setSlugError("Lütfen araç kodunuzu girin.");
      return;
    }
    setStoredOwnerSlug(clean);
    router.push(`/admin/${clean}`);
  };

  return (
    <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">
      {/* Subtle radial spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-[#3B82F6]/[0.05] via-[#141A24]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[400px] relative z-10 flex flex-col items-center text-center">
        {/* Emblem */}
        <div className="w-14 h-14 rounded-2xl bg-[#0E131C] border border-white/[0.08] flex items-center justify-center text-[#F7F9FC] mb-4">
          <Shield className="w-7 h-7 text-[#3B82F6]" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-[#F7F9FC] mb-1.5">
          Numaratik Yönetim Paneli
        </h1>
        <p className="text-xs text-[#98A2B3] max-w-[280px] mb-6">
          Aracınızı yönetin veya yeni bir akıllı araç kartı kaydı oluşturun.
        </p>

        {/* Action 1: Create New Vehicle (Prominent) */}
        <Link
          href="/yeni"
          className="w-full py-3.5 px-4 mb-4 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#3B82F6] hover:to-[#2563EB] text-[#F7F9FC] font-semibold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Yeni Araç Kaydı Oluştur</span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Link>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] font-medium text-[#98A2B3] uppercase tracking-wider">veya</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Action 2: Existing Vehicle Code Login */}
        <div className="w-full bg-[#080B12] border border-white/[0.08] rounded-[28px] p-5 shadow-xl text-left mt-2 flex flex-col gap-3">
          <span className="text-xs font-semibold text-[#F7F9FC]">Mevcut Aracınızı Yönetin</span>

          <form onSubmit={handleGoToSlug} className="flex flex-col gap-2.5">
            <div className="relative">
              <Car className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={inputSlug}
                onChange={(e) => {
                  setInputSlug(e.target.value);
                  setSlugError("");
                }}
                placeholder="Araç Kodu (Örn: card-xxxx veya arac)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0E131C] border border-white/[0.08] rounded-xl text-xs text-[#F7F9FC] placeholder-[#98A2B3]/50 focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>

            {slugError && <span className="text-[10px] text-red-400">{slugError}</span>}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#0E131C] border border-white/[0.08] hover:bg-white/[0.05] text-[#F7F9FC] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Yönetim Paneline Git</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#98A2B3]">
            <span>İlk varsayılan araç:</span>
            <button
              type="button"
              onClick={() => {
                setStoredOwnerSlug("arac");
                router.push("/admin/arac");
              }}
              className="text-[#3B82F6] hover:underline font-mono font-medium"
            >
              arac paneline git →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
