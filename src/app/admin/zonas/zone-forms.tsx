"use client";

import { useActionState } from "react";
import type { ZoneDto } from "@/contracts";
import { importCsv, removeZone, saveZone, type FormState } from "./actions";

const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm";
const btn = "rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100";

function Msg({ state }: { state: FormState }) {
  if (!state) return null;
  return <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>;
}

export function ZoneForm({ zone, parents }: { zone?: ZoneDto; parents: ZoneDto[] }) {
  const [state, action, pending] = useActionState(saveZone, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-6">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <input name="slug" placeholder="slug" defaultValue={zone?.slug} required className={input} aria-label="Slug" />
      <input name="nameEs" placeholder="Nombre (es)" defaultValue={zone?.nameEs} required className={input} aria-label="Nombre en español" />
      <input name="nameEn" placeholder="Name (en)" defaultValue={zone?.nameEn ?? ""} className={input} aria-label="Nombre en inglés" />
      <select name="parentId" defaultValue={zone?.parentId ?? ""} className={input} aria-label="Zona padre">
        <option value="">— sin padre —</option>
        {parents.filter((p) => p.id !== zone?.id).map((p) => <option key={p.id} value={p.id}>{p.nameEs}</option>)}
      </select>
      <input name="sortOrder" type="number" defaultValue={zone?.sortOrder ?? 0} className={input} aria-label="Orden" />
      <label className="flex items-center gap-1 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={zone?.isActive ?? true} /> Activa
      </label>
      <div className="flex items-center gap-3 sm:col-span-6">
        <button disabled={pending} className={btn}>{zone ? "Guardar" : "Crear zona"}</button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function DeleteZone({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeZone, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className={`${btn} text-red-700`}>Eliminar</button>
      <Msg state={state} />
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importCsv, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" aria-label="Archivo CSV" />
      <button disabled={pending} className={btn}>Importar CSV</button>
      <Msg state={state} />
    </form>
  );
}
