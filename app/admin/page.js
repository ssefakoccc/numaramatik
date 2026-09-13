"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminCardView from "@/components/admin/AdminCardView";
import { Loader2 } from "lucide-react";
import { useOwnerSlug } from "@/lib/useOwnerSlug";

export default function AdminPage() {
  const router = useRouter();
  const ownerSlug = useOwnerSlug();

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

  return <AdminCardView slug="arac" />;
}
