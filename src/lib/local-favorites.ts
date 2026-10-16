"use client";

import { useSyncExternalStore } from "react";

// Favoritos del público: se guardan en el navegador (sin cuenta). Es una lista de slugs, nunca datos personales.
const KEY = "terrae-favoritos";
const MAX = 100;
const EMPTY: string[] = [];

let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.list;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX) : EMPTY;
    cache = { raw, list: list.length ? list : EMPTY };
    return cache.list;
  } catch {
    return EMPTY;
  }
}

function write(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* navegación privada o sin permiso: no se guarda */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); }; // otra pestaña
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

/** Lista de slugs guardados (más recientes primero). En el servidor y en la primera pintura es vacía. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFavorite(slug: string) {
  const cur = read();
  write(cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur].slice(0, MAX));
}

export function removeFavorite(slug: string) {
  write(read().filter((s) => s !== slug));
}
