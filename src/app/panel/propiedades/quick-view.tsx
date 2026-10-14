"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { PhotoImg } from "@/components/photo-img";
import { StatusBadge } from "@/components/status-badge";
import { BLOCKER_LABEL, formatPrice, OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";
import { photoSrcSet, photoUrl } from "@/lib/photo-url";
import { propertyFacts } from "@/lib/property-facts";
import { quickViewAction, type QuickView as Data } from "./quick-view-action";

/** Botón + ventana modal (<dialog> nativo: foco, Esc y lectores de pantalla ya resueltos) con la ficha resumida. */
export function QuickView({ propertyId, className = "", preloaded = null }: { propertyId: string; className?: string; preloaded?: Data | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Data | null>(preloaded);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, startLoading] = useTransition();

  function open() {
    setError(null);
    setIndex(0);
    dialog.current?.showModal();
    if (data) return;
    startLoading(async () => {
      const r = await quickViewAction(propertyId);
      if (r.ok) setData(r);
      else setError(r.message);
    });
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!el.open || !data || data.photos.length < 2) return;
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % data.photos.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + data.photos.length) % data.photos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data]);

  const p = data?.property;
  const photos = data?.photos ?? [];
  const current = photos[index];
  const money = (n: number) => formatPrice(n, p?.currency ?? "USD");
  const publishing = p && (p.status === "draft" || p.status === "paused") && p.blockers.length > 0;

  return (
    <>
      <button type="button" onClick={open} className={`btn px-3 py-1.5 text-xs shadow ${className}`} aria-haspopup="dialog">
        <span aria-hidden>👁</span> Vista rápida
      </button>
      <dialog
        ref={dialog} className="dialog" aria-label="Vista rápida de la propiedad"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()} // clic en el fondo oscuro
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <p className="font-medium">Vista rápida</p>
          <button type="button" className="btn px-3 py-1" onClick={() => dialog.current?.close()} aria-label="Cerrar">✕</button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {loading && !data && <p className="muted py-10 text-center">Cargando…</p>}
          {error && <p role="alert" className="alert alert-error">{error}</p>}
          {p && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-200">
                  {current ? (
                    <PhotoImg
                      key={current.id} src={photoUrl(current.storageKey, 800)} srcSet={photoSrcSet(current.storageKey)} sizes="(min-width: 768px) 28rem, 90vw"
                      alt={current.altText ?? `Foto ${index + 1} de ${photos.length}`} className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="muted flex h-full items-center justify-center text-sm">Sin fotos todavía</div>
                  )}
                  {photos.length > 1 && (
                    <>
                      <button type="button" className="btn absolute left-2 top-1/2 -translate-y-1/2 px-3 py-1 shadow" aria-label="Foto anterior" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}>←</button>
                      <button type="button" className="btn absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 shadow" aria-label="Foto siguiente" onClick={() => setIndex((i) => (i + 1) % photos.length)}>→</button>
                      <span className="badge absolute bottom-2 right-2 bg-black/70 text-white">{index + 1} / {photos.length}</span>
                    </>
                  )}
                </div>
                {photos.length > 1 && (
                  <ul className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((ph, i) => (
                      <li key={ph.id} className="shrink-0">
                        <button type="button" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === index}
                          className={`block h-14 w-20 overflow-hidden rounded border-2 ${i === index ? "border-blue-700" : "border-transparent"}`}>
                          <PhotoImg src={photoUrl(ph.storageKey, 400)} alt={`Miniatura ${i + 1}`} className="h-full w-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} operation={p.operation} />
                  <span className="muted text-sm">{TYPE_LABEL[p.type]} en {OPERATION_LABEL[p.operation].toLowerCase()} · {data.zoneName}</span>
                </div>
                <h2 className="text-xl font-semibold">{p.title}</h2>
                <p className="text-2xl font-semibold">{money(p.price)}</p>
                <p className="muted whitespace-pre-line text-sm">{p.description.length > 320 ? `${p.description.slice(0, 320)}…` : p.description}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {propertyFacts(p, money).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="muted">{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                {publishing && (
                  <div className="alert alert-error text-sm">
                    <p className="font-medium">Para publicar falta:</p>
                    <ul className="list-disc pl-5">{p.blockers.map((b) => <li key={b}>{BLOCKER_LABEL[b]}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cerrar</button>
          <Link href={`/panel/propiedades/${propertyId}`} className="btn btn-primary">Abrir y editar</Link>
        </div>
      </dialog>
    </>
  );
}
