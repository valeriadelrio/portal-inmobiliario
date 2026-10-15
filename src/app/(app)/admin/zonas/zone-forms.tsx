"use client";

import { Select } from "@/components/select";
import { useActionState } from "react";
import type { ZoneDto } from "@/contracts";
import { importCsv, removeZone, saveZone, type FormState } from "./actions";

function Msg({ state }: { state: FormState }) {
  if (!state) return null;
  return <p role="status" className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>;
}

export function ZoneForm({ zone, parents }: { zone?: ZoneDto; parents: ZoneDto[] }) {
  const [state, action, pending] = useActionState(saveZone, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <label className="label">Identificador (slug)
        <input name="slug" placeholder="villa-italia" defaultValue={zone?.slug} required className="input" />
      </label>
      <label className="label">Nombre en español
        <input name="nameEs" placeholder="Villa Italia" defaultValue={zone?.nameEs} required className="input" />
      </label>
      <label className="label">Nombre en inglés (opcional)
        <input name="nameEn" defaultValue={zone?.nameEn ?? ""} className="input" />
      </label>
      <label className="label">Zona padre
        <Select name="parentId" defaultValue={zone?.parentId ?? ""} className="input">
          <option value="">— ninguna —</option>
          {parents.filter((p) => p.id !== zone?.id).map((p) => <option key={p.id} value={p.id}>{p.nameEs}</option>)}
        </Select>
      </label>
      <label className="label">Orden
        <input name="sortOrder" type="number" defaultValue={zone?.sortOrder ?? 0} className="input" />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={zone?.isActive ?? true} className="h-4 w-4" /> Activa
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button disabled={pending} className="btn btn-primary">{zone ? "Guardar cambios" : "Crear zona"}</button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function DeleteZone({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeZone, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn btn-danger">Eliminar zona</button>
      <Msg state={state} />
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importCsv, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input name="file" type="file" accept=".csv,text/csv" required className="input max-w-xs" aria-label="Archivo CSV" />
      <button disabled={pending} className="btn btn-primary">Importar CSV</button>
      <Msg state={state} />
    </form>
  );
}
