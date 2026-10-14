"use client";

import { useState } from "react";

/** <img> que, si el archivo falta o no carga, muestra un aviso en vez de la imagen rota. */
export function PhotoImg({ src, srcSet, sizes, alt, className = "", loading }: {
  src: string; srcSet?: string; sizes?: string; alt: string; className?: string; loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div role="img" aria-label={`${alt} (archivo no disponible)`} className="muted flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-200 p-2 text-center text-xs">
        <span aria-hidden className="text-xl">⚠️</span>Archivo no disponible
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading={loading} className={className} onError={() => setFailed(true)} />;
}
