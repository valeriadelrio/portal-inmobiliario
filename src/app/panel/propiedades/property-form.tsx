"use client";

import { Select } from "@/components/select";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { CURRENCY, LOT_SERVICES, PROPERTY_TYPE, type PropertyInput, type ZoneDto } from "@/contracts";
import { LOT_SERVICE_LABEL, OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";
import { saveProperty } from "./actions";

type Props = {
  zones: ZoneDto[];
  /** Solo el admin de la inmobiliaria elige a nombre de qué agente se carga. */
  agents?: { id: string; name: string }[];
  initial?: PropertyInput & { id: string };
};

const v = (x: number | string | undefined | null) => (x === undefined || x === null ? "" : String(x));

export function PropertyForm({ zones, agents, initial }: Props) {
  const [state, action, pending] = useActionState(saveProperty, null);
  const [type, setType] = useState<string>(initial?.type ?? "house");
  const editing = !!initial;
  const lot = initial?.type === "lot" ? initial : undefined;
  const bld = initial && initial.type !== "lot" ? initial : undefined;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {editing && <input type="hidden" name="id" value={initial.id} />}
      {editing && <input type="hidden" name="type" value={initial.type} />}

      <label className="label">Operación
        <Select name="operation" defaultValue={initial?.operation ?? "sale"} className="input">
          {Object.entries(OPERATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </label>
      <label className="label">Tipo de propiedad
        {editing ? (
          <input value={TYPE_LABEL[initial.type]} disabled className="input" aria-describedby="type-help" />
        ) : (
          <Select name="type" value={type} onChange={setType} className="input">
            {PROPERTY_TYPE.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </Select>
        )}
        {editing && <span id="type-help" className="muted text-xs font-normal">El tipo no se puede cambiar una vez creada la ficha.</span>}
      </label>

      <label className="label sm:col-span-2">Título
        <input name="title" defaultValue={initial?.title} required minLength={5} maxLength={140} className="input" placeholder="Ej: Casa de 3 dormitorios en Villa Italia" />
      </label>
      <label className="label sm:col-span-2">Descripción
        <textarea name="description" defaultValue={initial?.description} required minLength={20} maxLength={5000} rows={5} className="input" />
      </label>

      <label className="label">Zona o barrio
        <Select name="zoneId" defaultValue={initial?.zoneId ?? ""} required className="input">
          <option value="" disabled>Elegí una zona…</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.nameEs}</option>)}
        </Select>
      </label>
      <label className="label">Dirección (opcional)
        <input name="addressText" defaultValue={initial?.addressText} maxLength={200} className="input" />
        <span className="flex items-center gap-2 pt-1 text-xs font-normal">
          <input type="checkbox" name="showExactAddress" defaultChecked={initial?.showExactAddress} /> Mostrar la dirección exacta en la publicación
        </span>
      </label>

      <label className="label">Precio
        <input name="price" defaultValue={v(initial?.price)} required inputMode="decimal" className="input" placeholder="120000" />
      </label>
      <label className="label">Moneda
        <Select name="currency" defaultValue={initial?.currency ?? "USD"} className="input">
          {CURRENCY.map((c) => <option key={c} value={c}>{c === "USD" ? "Dólares (USD)" : "Pesos (ARS)"}</option>)}
        </Select>
      </label>
      <label className="label">Expensas mensuales (opcional)
        <input name="expenses" defaultValue={v(initial?.expenses)} inputMode="decimal" className="input" />
      </label>
      <label className="label">Idioma de la publicación
        <Select name="language" defaultValue={initial?.language ?? "es"} className="input">
          <option value="es">Español</option><option value="en">Inglés</option>
        </Select>
      </label>

      <label className="label">Superficie total (m²)
        <input name="totalAreaM2" defaultValue={v(initial?.totalAreaM2)} required inputMode="decimal" className="input" />
      </label>
      {type !== "lot" && (
        <label className="label">Superficie cubierta (m²)
          <input name="coveredAreaM2" defaultValue={v(initial?.coveredAreaM2)} inputMode="decimal" className="input" />
        </label>
      )}

      {type === "lot" ? (
        <fieldset className="grid gap-4 rounded-lg border border-slate-300 p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-2 text-sm font-medium">Datos del lote</legend>
          <label className="label">Frente (m)<input name="frontageM" defaultValue={v(lot?.frontageM)} inputMode="decimal" className="input" /></label>
          <label className="label">Fondo (m)<input name="depthM" defaultValue={v(lot?.depthM)} inputMode="decimal" className="input" /></label>
          <label className="label">Zonificación (opcional)<input name="zoning" defaultValue={lot?.zoning} className="input" /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="isCorner" defaultChecked={lot?.isCorner} className="h-4 w-4" /> Es lote de esquina
          </label>
          <div className="sm:col-span-2">
            <p className="label">Servicios disponibles</p>
            <div className="mt-1 flex flex-wrap gap-4">
              {LOT_SERVICES.map((sv) => (
                <label key={sv} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="services" value={sv} defaultChecked={lot?.services.includes(sv)} className="h-4 w-4" /> {LOT_SERVICE_LABEL[sv]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-4 rounded-lg border border-slate-300 p-4 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="px-2 text-sm font-medium">Características</legend>
          <label className="label">Ambientes<input name="rooms" defaultValue={v(bld?.rooms)} required inputMode="numeric" className="input" /></label>
          <label className="label">Dormitorios<input name="bedrooms" defaultValue={v(bld?.bedrooms)} required inputMode="numeric" className="input" /></label>
          <label className="label">Baños<input name="bathrooms" defaultValue={v(bld?.bathrooms)} required inputMode="numeric" className="input" /></label>
          <label className="label">Cocheras<input name="garages" defaultValue={v(bld?.garages ?? 0)} inputMode="numeric" className="input" /></label>
          <label className="label">Antigüedad (años)<input name="ageYears" defaultValue={v(bld?.ageYears)} inputMode="numeric" className="input" /></label>
          <label className="label">Piso (si corresponde)<input name="floor" defaultValue={v(bld?.floor)} inputMode="numeric" className="input" /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="hasElevator" defaultChecked={bld?.hasElevator} className="h-4 w-4" /> Tiene ascensor
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="furnished" defaultChecked={bld?.furnished} className="h-4 w-4" /> Amoblado
          </label>
          <label className="label sm:col-span-2 lg:col-span-4">Comodidades (separadas por coma)
            <input name="amenities" defaultValue={bld?.amenities.join(", ")} className="input" placeholder="pileta, parrilla, quincho" />
          </label>
        </fieldset>
      )}

      {!editing && agents && agents.length > 1 && (
        <label className="label sm:col-span-2">Agente responsable
          <Select name="agentId" defaultValue="" className="input">
            <option value="">Yo</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary">{editing ? "Guardar cambios" : "Crear borrador"}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
