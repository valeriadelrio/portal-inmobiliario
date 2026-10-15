"use client";

import { useSyncExternalStore } from "react";

const PALETTES = [["p1", "1 · Arcilla y salvia"], ["p3", "3 · Tierra y turquesa"]] as const;

// La paleta vive en el atributo data-palette de <html> (lo pone el script del encabezado y este botón).
const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette"] });
  return () => obs.disconnect();
};
const snapshot = () => (document.documentElement.getAttribute("data-palette") === "p3" ? "p3" : "p1");

/** TEMPORAL (solo desarrollo): alterna entre las dos paletas candidatas. Se elimina al elegir una. */
export function PaletteSwitch() {
  const current = useSyncExternalStore(subscribe, snapshot, () => "p1");
  function pick(id: string) {
    document.documentElement.setAttribute("data-palette", id);
    try { localStorage.setItem("terrae-palette", id); } catch { /* sin almacenamiento */ }
  }
  return (
    <div role="group" aria-label="Probar paleta de colores" className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 text-xs shadow-lg">
      <span className="px-2 font-medium text-slate-600">Paleta</span>
      {PALETTES.map(([id, label]) => (
        <button key={id} type="button" onClick={() => pick(id)} aria-pressed={current === id}
          className={`rounded-full px-3 py-1 font-medium ${current === id ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          {current === id ? "✓ " : ""}{label}
        </button>
      ))}
    </div>
  );
}
