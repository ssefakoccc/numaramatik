"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  LogOut,
  Car,
  QrCode,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Trash2,
  X,
  Copy,
  Check,
  Smartphone,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatDisplayPhone } from "@/lib/phone";

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function SuperAdminPage() {
  const [masterKey, setMasterKey] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("numaratik_master_key") || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'tg_connected' | 'tg_none' | 'active'

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    vehicle: null,
    loading: false,
    error: null,
  });

  const [copiedSlug, setCopiedSlug] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = (text, slug) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSlug(slug);
    showToast("Bağlantı panoya kopyalandı!");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Fetch Dashboard Data
  const fetchData = useCallback(async (keyToUse, isRefresh = false) => {
    const key = keyToUse || masterKey;
    if (!key) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingData(true);
    }

    try {
      const res = await fetch("/api/super-admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: key }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401 || res.status === 429) {
          setIsAuthenticated(false);
          sessionStorage.removeItem("numaratik_master_key");
          setAuthError(data.error || "Yetkilendirme başarısız.");
        } else {
          showToast(data.error || "Veriler yüklenemedi.", "error");
        }
        return;
      }

      setStats(data.stats);
      setVehicles(data.vehicles || []);
      setIsAuthenticated(true);
      sessionStorage.setItem("numaratik_master_key", key);
      setAuthError(null);
    } catch {
      showToast("Sunucuya bağlanırken bir sorun oluştu.", "error");
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [masterKey]);

  // Initial load from sessionStorage
  useEffect(() => {
    let cancelled = false;
    const savedKey = typeof window !== "undefined" ? sessionStorage.getItem("numaratik_master_key") : null;
    if (savedKey) {
      setTimeout(() => {
        if (!cancelled) {
          fetchData(savedKey);
        }
      }, 0);
    }
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!masterKey.trim()) {
      setAuthError("Lütfen Master Şifrenizi girin.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    await fetchData(masterKey.trim());
    setAuthLoading(false);
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem("numaratik_master_key");
    setIsAuthenticated(false);
    setMasterKey("");
    setStats(null);
    setVehicles([]);
  };

  // Handle Delete Vehicle
  const handleDeleteVehicle = async () => {
    if (!deleteModal.vehicle || !masterKey) return;

    setDeleteModal((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/super-admin/delete-vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey: masterKey,
          slug: deleteModal.vehicle.slug,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setDeleteModal((prev) => ({
          ...prev,
          loading: false,
          error: data.error || "Araç silinemedi.",
        }));
        return;
      }

      showToast(`${deleteModal.vehicle.displayName || deleteModal.vehicle.slug} aracı başarıyla silindi.`);
      setDeleteModal({ isOpen: false, vehicle: null, loading: false, error: null });
      // Refresh list
      fetchData(masterKey, true);
    } catch {
      setDeleteModal((prev) => ({
        ...prev,
        loading: false,
        error: "Bağlantı hatası oluştu.",
      }));
    }
  };

  // Filtered Vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (v.displayName && v.displayName.toLowerCase().includes(q)) ||
        (v.slug && v.slug.toLowerCase().includes(q)) ||
        (v.phoneNumber && v.phoneNumber.includes(q));

      if (!matchesQuery) return false;

      if (filterTab === "tg_connected") return v.telegram?.connected;
      if (filterTab === "tg_none") return !v.telegram?.connected;
      if (filterTab === "active") return v.isActivated;

      return true;
    });
  }, [vehicles, searchQuery, filterTab]);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#05070B] text-[#F7F9FC] flex items-center justify-center p-4 relative selection:bg-blue-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/15 via-transparent to-transparent pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0E131C] border border-blue-500/20 shadow-xl shadow-blue-500/5 mb-4 text-blue-400">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Numaratik Master Panel</h1>
            <p className="text-sm text-[#98A2B3] mt-1.5">Platform sahibi ve sistem yönetimi erişimi</p>
          </div>

          <div className="bg-[#0E131C]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-2xl">
            {authError && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{authError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#98A2B3] uppercase tracking-wider mb-2">
                  Master Güvenlik Anahtarı
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#667085]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="ADMIN_SECRET_KEY"
                    required
                    autoFocus
                    className="w-full pl-10 pr-12 py-3 bg-[#141A24] border border-white/[0.08] rounded-xl text-white placeholder-[#667085] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#667085] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Doğrulanıyor...</span>
                  </>
                ) : (
                  <span>Panele Giriş Yap</span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
              <Link
                href="/yeni"
                className="text-xs text-[#98A2B3] hover:text-white transition-colors"
              >
                ← Ana Sayfaya Dön
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // DASHBOARD SCREEN
  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7F9FC] pb-16 selection:bg-blue-500/20">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-in fade-in slide-in-from-bottom-5 duration-200 text-sm font-medium ${toast.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-500/30' : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'}">
          {toast.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#080B12]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">NUMARATİK</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Master
                </span>
              </div>
              <p className="text-xs text-[#98A2B3] hidden sm:block">Sistem Genel Bakışı ve Araç Yönetimi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(masterKey, true)}
              disabled={refreshing || loadingData}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141A24] hover:bg-[#1A2230] border border-white/[0.08] text-xs font-medium text-[#98A2B3] hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
              <span className="hidden sm:inline">Yenile</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium text-red-400 transition-all cursor-pointer"
              title="Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* STATS OVERVIEW CARDS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#98A2B3] uppercase tracking-wider">
              Sistem Raporları & İstatistikler
            </h2>
            {loadingData && <Loader2 className="w-4 h-4 animate-spin text-[#667085]" />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* 1. Toplam Araç */}
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#98A2B3] font-medium">Toplam Araç</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {stats ? stats.totalVehicles : "-"}
              </div>
              <div className="mt-1 text-[11px] text-[#667085]">Sistemde kayıtlı</div>
            </div>

            {/* 2. Aktif Araçlar */}
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#98A2B3] font-medium">Aktif Araçlar</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
                {stats ? stats.activeVehicles : "-"}
              </div>
              <div className="mt-1 text-[11px] text-[#667085]">Kullanıma hazır</div>
            </div>

            {/* 3. Telegram Bağlı */}
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-sky-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#98A2B3] font-medium">Telegram Aktif</span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-sky-400 tracking-tight">
                {stats ? stats.telegramConnectedVehicles : "-"}
              </div>
              <div className="mt-1 text-[11px] text-[#667085]">
                {stats && stats.totalVehicles > 0
                  ? `%${Math.round((stats.telegramConnectedVehicles / stats.totalVehicles) * 100)} entegre`
                  : "Bot bağlı"}
              </div>
            </div>

            {/* 4. Toplam QR Okutma */}
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#98A2B3] font-medium">Toplam QR Okutma</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">
                {stats ? stats.totalScans : "-"}
              </div>
              <div className="mt-1 text-[11px] text-[#667085]">Tüm tarama olayları</div>
            </div>

            {/* 5. Bildirim / Durum Olayı */}
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-violet-500/30 transition-all col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#98A2B3] font-medium">Durum Bildirimleri</span>
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-violet-400 tracking-tight">
                {stats ? stats.totalScenarios : "-"}
              </div>
              <div className="mt-1 text-[11px] text-[#667085]">Gönderilen hazır mesaj</div>
            </div>
          </div>
        </section>

        {/* VEHICLE MANAGEMENT SECTION */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Kayıtlı Araç Listesi</h2>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Sistemdeki tüm araçları görüntüleyin, inceleyin veya silin ({filteredVehicles.length} araç)
              </p>
            </div>

            {/* Link to create new card */}
            <Link
              href="/yeni"
              target="_blank"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all self-start sm:self-auto cursor-pointer"
            >
              <span>+ Yeni Araç Tanımla</span>
            </Link>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Araç adı, plaka, slug veya telefon numarası ara..."
                className="w-full pl-10 pr-4 py-2 bg-[#141A24] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#667085] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${filterTab === "all" ? "bg-white/10 text-white" : "text-[#98A2B3] hover:bg-white/[0.04]"}`}
              >
                Tümü ({vehicles.length})
              </button>
              <button
                onClick={() => setFilterTab("tg_connected")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${filterTab === "tg_connected" ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-[#98A2B3] hover:bg-white/[0.04]"}`}
              >
                Telegram Bağlı ({vehicles.filter((v) => v.telegram?.connected).length})
              </button>
              <button
                onClick={() => setFilterTab("tg_none")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${filterTab === "tg_none" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-[#98A2B3] hover:bg-white/[0.04]"}`}
              >
                Telegram Yok ({vehicles.filter((v) => !v.telegram?.connected).length})
              </button>
              <button
                onClick={() => setFilterTab("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${filterTab === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[#98A2B3] hover:bg-white/[0.04]"}`}
              >
                Aktif ({vehicles.filter((v) => v.isActivated).length})
              </button>
            </div>
          </div>

          {/* Table / Card List */}
          {loadingData && vehicles.length === 0 ? (
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-[#98A2B3]">Araç verileri yükleniyor...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl p-12 text-center">
              <Car className="w-10 h-10 text-[#667085] mx-auto mb-3" />
              <p className="text-base font-medium text-white mb-1">Araç bulunamadı</p>
              <p className="text-xs text-[#98A2B3]">
                {searchQuery ? "Arama kriterlerinize uygun araç bulunamadı." : "Henüz hiç araç kaydedilmemiş."}
              </p>
            </div>
          ) : (
            <div className="bg-[#0E131C] border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141A24]/70 border-b border-white/[0.06] text-[#98A2B3] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3.5 px-5">Araç / Plaka</th>
                      <th className="py-3.5 px-4">Slug / Link</th>
                      <th className="py-3.5 px-4">Telefon Numarası</th>
                      <th className="py-3.5 px-4">Telegram Durumu</th>
                      <th className="py-3.5 px-4">Kayıt Tarihi</th>
                      <th className="py-3.5 px-5 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredVehicles.map((vehicle) => {
                      const fullCardUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${vehicle.slug}` : `/c/${vehicle.slug}`;
                      return (
                        <tr
                          key={vehicle.id || vehicle.slug}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Display Name */}
                          <td className="py-4 px-5">
                            <div className="font-semibold text-white text-sm">
                              {vehicle.displayName || "İsimsiz Araç"}
                            </div>
                            <div className="text-[11px] text-[#667085] mt-0.5">
                              ID: {vehicle.id ? `${String(vehicle.id).slice(0, 8)}...` : vehicle.slug}
                            </div>
                          </td>

                          {/* Slug & Link */}
                          <td className="py-4 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-[#141A24] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                              <span className="font-mono text-blue-400 font-medium">{vehicle.slug}</span>
                              <button
                                onClick={() => copyToClipboard(fullCardUrl, vehicle.slug)}
                                className="text-[#667085] hover:text-white transition-colors ml-1 p-0.5"
                                title="Kart Linkini Kopyala"
                              >
                                {copiedSlug === vehicle.slug ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Phone Number */}
                          <td className="py-4 px-4 font-mono text-[#F7F9FC]">
                            {vehicle.phoneNumber ? formatDisplayPhone(vehicle.phoneNumber) : "-"}
                          </td>

                          {/* Telegram Status */}
                          <td className="py-4 px-4">
                            {vehicle.telegram?.connected ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Bağlı</span>
                                {vehicle.telegram.botUsername && (
                                  <span className="text-[#98A2B3]">(@{vehicle.telegram.botUsername})</span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-[#98A2B3] border border-white/[0.06]">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                                <span>Bağlı Değil</span>
                              </span>
                            )}
                          </td>

                          {/* Created Date */}
                          <td className="py-4 px-4 text-[#98A2B3]">
                            {formatDateTime(vehicle.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/c/${vehicle.slug}`}
                                target="_blank"
                                className="p-2 rounded-lg bg-[#141A24] hover:bg-[#1A2230] text-[#98A2B3] hover:text-white border border-white/[0.06] transition-all"
                                title="Araç Sayfasını Aç"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>

                              <Link
                                href={`/admin/${vehicle.slug}`}
                                target="_blank"
                                className="px-2.5 py-1.5 rounded-lg bg-[#141A24] hover:bg-[#1A2230] text-blue-400 hover:text-blue-300 border border-white/[0.06] font-medium text-xs transition-all"
                                title="Araç Admin Paneli"
                              >
                                Admin
                              </Link>

                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    isOpen: true,
                                    vehicle,
                                    loading: false,
                                    error: null,
                                  })
                                }
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                                title="Bu Aracı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Card View */}
              <div className="lg:hidden divide-y divide-white/[0.06]">
                {filteredVehicles.map((vehicle) => {
                  const fullCardUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${vehicle.slug}` : `/c/${vehicle.slug}`;
                  return (
                    <div key={vehicle.id || vehicle.slug} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white text-base">
                            {vehicle.displayName || "İsimsiz Araç"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              {vehicle.slug}
                            </span>
                            <button
                              onClick={() => copyToClipboard(fullCardUrl, vehicle.slug)}
                              className="text-xs text-[#98A2B3] hover:text-white flex items-center gap-1"
                            >
                              {copiedSlug === vehicle.slug ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>Linki Kopyala</span>
                            </button>
                          </div>
                        </div>

                        {/* Telegram Badge */}
                        {vehicle.telegram?.connected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            TG Bağlı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-[#98A2B3] border border-white/[0.06] shrink-0">
                            TG Yok
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-[#98A2B3] pt-1">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-[#667085]" />
                          <span className="font-mono">{vehicle.phoneNumber ? formatDisplayPhone(vehicle.phoneNumber) : "-"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                          <span>{formatDateTime(vehicle.createdAt)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/c/${vehicle.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#141A24] text-xs font-medium text-white border border-white/[0.06]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Sayfa</span>
                          </Link>
                          <Link
                            href={`/admin/${vehicle.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 text-xs font-medium text-blue-400 border border-blue-500/20"
                          >
                            <span>Admin Aç</span>
                          </Link>
                        </div>

                        <button
                          onClick={() =>
                            setDeleteModal({
                              isOpen: true,
                              vehicle,
                              loading: false,
                              error: null,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-xs font-medium text-red-400 border border-red-500/20 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Sil</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && deleteModal.vehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0E131C] border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Aracı Kalıcı Olarak Sil</h3>

            <p className="text-sm text-[#98A2B3] mb-4">
              <strong className="text-white">
                {deleteModal.vehicle.displayName || deleteModal.vehicle.slug}
              </strong>{" "}
              ({deleteModal.vehicle.slug}) aracını sistemden silmek üzeresiniz.
            </p>

            <div className="bg-[#141A24] border border-white/[0.06] rounded-xl p-3 text-xs text-[#98A2B3] space-y-1 mb-5">
              <p className="font-semibold text-red-400">Bu işlem geri alınamaz!</p>
              <p>• Araca ait oluşturulmuş tüm QR kodlar geçersiz kılınır.</p>
              <p>• Telegram bildirim botu bağlantısı koparılır.</p>
              <p>• Olay ve tarama kayıtları kalıcı olarak temizlenir.</p>
            </div>

            {deleteModal.error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteModal.error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleteModal.loading}
                onClick={() => setDeleteModal({ isOpen: false, vehicle: null, loading: false, error: null })}
                className="px-4 py-2 rounded-xl bg-[#141A24] hover:bg-[#1A2230] text-xs font-semibold text-[#98A2B3] hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                İptal
              </button>

              <button
                type="button"
                disabled={deleteModal.loading}
                onClick={handleDeleteVehicle}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteModal.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Evet, Kalıcı Olarak Sil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
