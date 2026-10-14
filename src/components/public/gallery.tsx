"use client";

import { useState } from "react";
import { PhotoImg } from "@/components/photo-img";
import { photoSrcSet, photoUrl } from "@/lib/photo-url";

type Photo = { id: string; storageKey: string; altText: string | null };

/** Galería de la ficha pública: foto grande, flechas (también con el teclado) y miniaturas. */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return <div className="muted flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-200">Esta propiedad todavía no tiene fotos</div>;
  }
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  const cur = photos[i];
  return (
    <div
      className="space-y-2" tabIndex={0} aria-label={`Galería de fotos de ${title}`}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
        <PhotoImg
          key={cur.id} src={photoUrl(cur.storageKey, 1600)} srcSet={photoSrcSet(cur.storageKey)} sizes="(min-width: 1024px) 40rem, 100vw"
          alt={cur.altText ?? `${title} — foto ${i + 1} de ${photos.length}`} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover"
        />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="btn absolute left-3 top-1/2 -translate-y-1/2 px-3 py-1.5 shadow">←</button>
            <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="btn absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 shadow">→</button>
            <span className="badge absolute bottom-3 right-3 bg-black/70 text-white">{i + 1} / {photos.length}</span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, n) => (
            <li key={p.id} className="shrink-0">
              <button type="button" onClick={() => setI(n)} aria-label={`Ver foto ${n + 1}`} aria-current={n === i}
                className={`block h-16 w-24 overflow-hidden rounded border-2 ${n === i ? "border-blue-700" : "border-transparent"}`}>
                <PhotoImg src={photoUrl(p.storageKey, 400)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
