"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PhotoImg } from "@/components/photo-img";
import { ALLOWED_MIME, MAX_BYTES, MAX_PHOTOS, type PhotoDto } from "@/contracts";
import { photoUrl } from "@/lib/photo-url";
import { confirmUploadAction, deletePhotoAction, reorderAction, requestUploadAction, setCoverAction } from "./photo-actions";

type Upload = { name: string; state: "uploading" | "done" | "error"; message?: string };

export function PhotoManager({ propertyId, photos }: { propertyId: string; photos: PhotoDto[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = photos.filter((p) => p.status === "ready");
  const busy = uploads.some((u) => u.state === "uploading");

  async function uploadOne(file: File, index: number) {
    const set = (u: Partial<Upload>) => setUploads((all) => all.map((x, i) => (i === index ? { ...x, ...u } : x)));
    try {
      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return set({ state: "error", message: "Formato no permitido (usá JPG, PNG o WebP)" });
      if (file.size > MAX_BYTES) return set({ state: "error", message: "Supera los 10 MB" });
      const req = await requestUploadAction(propertyId, file.type, file.size);
      if (!req.ok) return set({ state: "error", message: req.message });
      const put = await fetch(req.url, { method: "PUT", headers: req.headers, body: file });
      if (!put.ok) return set({ state: "error", message: "No se pudo subir el archivo" });
      const done = await confirmUploadAction(propertyId, req.photoId);
      set(done.ok ? { state: "done" } : { state: "error", message: done.message });
    } catch {
      set({ state: "error", message: "Error de conexión" });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    setError(files.length > list.length ? `Solo entran ${MAX_PHOTOS} fotos por propiedad.` : null);
    setUploads(list.map((f) => ({ name: f.name, state: "uploading" })));
    for (const [i, f] of list.entries()) await uploadOne(f, i); // de a una: más simple y cuida la memoria
    if (input.current) input.current.value = "";
    router.refresh();
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "No se pudo completar la acción");
      else router.refresh();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderAction(propertyId, ids));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || photos.length >= MAX_PHOTOS}
          onChange={(e) => onFiles(e.target.files)} className="input max-w-xs" aria-label="Elegir fotos"
        />
        <span className="muted text-sm">{ready.length} de {MAX_PHOTOS} fotos listas · JPG, PNG o WebP, hasta 10 MB</span>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-1 text-sm">
          {uploads.map((u, i) => (
            <li key={i} className={u.state === "error" ? "text-red-700" : "text-slate-700"}>
              {u.state === "uploading" && "⏳ "}{u.state === "done" && "✓ "}{u.state === "error" && "✕ "}{u.name}{u.message ? ` — ${u.message}` : ""}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      {photos.length === 0 ? (
        <p className="muted text-sm">Todavía no hay fotos. La primera que subas será la portada.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="card space-y-2 p-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded bg-slate-200">
                {p.status === "ready" ? (
                  <PhotoImg src={photoUrl(p.storageKey, 400)} alt={p.altText ?? `Foto ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="muted flex h-full items-center justify-center text-xs">Procesando…</span>
                )}
                {p.isCover && <span className="badge absolute left-1 top-1 bg-blue-700 text-white">Portada</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="btn px-2 py-1 text-xs" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Mover antes">←</button>
                <button type="button" className="btn px-2 py-1 text-xs" disabled={pending || i === photos.length - 1} onClick={() => move(i, 1)} aria-label="Mover después">→</button>
                {!p.isCover && p.status === "ready" && (
                  <button type="button" className="btn px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setCoverAction(propertyId, p.id))}>Portada</button>
                )}
                <button type="button" className="btn btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => deletePhotoAction(propertyId, p.id))}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
