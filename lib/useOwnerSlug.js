"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "numaratik_owner_slug";

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return "";
}

function subscribe(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Hook to retrieve the currently active vehicle slug on this device.
 * Uses useSyncExternalStore for hydration-safe external state synchronization without setState in effects.
 */
export function useOwnerSlug() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setStoredOwnerSlug(slug) {
  try {
    if (slug) {
      localStorage.setItem(STORAGE_KEY, slug);
      window.dispatchEvent(new Event("storage"));
    }
  } catch {}
}

export function clearStoredOwnerSlug() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("storage"));
  } catch {}
}
