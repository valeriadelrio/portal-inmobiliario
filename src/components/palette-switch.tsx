"use client";

const PALETTES = [["p1", "1 · Arcilla y salvia"], ["p3", "3 · Tierra y turquesa"]] as const;

/** TEMPORAL (solo desarrollo): alterna entre las dos paletas candidatas. Se elimina al elegir una. */
export function PaletteSwitch() {
  function pick(id: string) {
    document.documentElement.setAttribute("data-palette", id);
    try { localStorage.setItem("terrae-palette", id); } catch { /* sin almacenamiento */ }
  }
  return (
    <div role="group" aria-label="Probar paleta de colores" className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 text-xs shadow-lg">
      <span className="px-2 font-medium text-slate-600">Paleta</span>
      {PALETTES.map(([id, label]) => (
        <button key={id} type="button" data-pal={id} onClick={() => pick(id)} className="pal-btn rounded-full px-3 py-1 font-medium text-slate-700 hover:bg-slate-100">{label}</button>
      ))}
    </div>
  );
}
