import { Select } from "@/components/select";
import Link from "next/link";
import type { SearchFilters, ZoneDto } from "@/contracts";
import { PROPERTY_TYPE } from "@/contracts";
import { OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";

/** Filtros del buscador: un <form method="get">, sin JavaScript. La URL resultante se puede compartir. */
export function SearchFiltersForm({ f, zones }: { f: SearchFilters; zones: ZoneDto[] }) {
  const parents = zones.filter((z) => !z.parentId);
  const childrenOf = (id: string) => zones.filter((z) => z.parentId === id);
  const zone = f.zone?.[0] ?? "";
  const type = f.type?.[0] ?? "";
  return (
    <form method="get" action="/propiedades" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="label">Operación
        <Select name="op" defaultValue={f.op ?? ""} className="input">
          <option value="">Venta y alquiler</option>
          {Object.entries(OPERATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </label>
      <label className="label">Tipo
        <Select name="type" defaultValue={type} className="input">
          <option value="">Todos</option>
          {PROPERTY_TYPE.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </Select>
      </label>
      <label className="label">Zona o barrio
        <Select name="zone" defaultValue={zone} className="input">
          <option value="">Toda la ciudad</option>
          {parents.map((p) => (
            <optgroup key={p.id} label={p.nameEs}>
              <option value={p.slug}>{p.nameEs} (toda la zona)</option>
              {childrenOf(p.id).map((c) => <option key={c.id} value={c.slug}>{c.nameEs}</option>)}
            </optgroup>
          ))}
        </Select>
      </label>
      <label className="label">Ordenar por
        <Select name="sort" defaultValue={f.sort} className="input">
          <option value="recent">Más recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </Select>
      </label>
      <label className="label">Precio mínimo
        <input name="minPrice" type="number" min={0} inputMode="numeric" defaultValue={f.minPrice} className="input" />
      </label>
      <label className="label">Precio máximo
        <input name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={f.maxPrice} className="input" />
      </label>
      <label className="label">Moneda del precio
        <Select name="currency" defaultValue={f.currency ?? ""} className="input">
          <option value="">Dólares (USD)</option>
          <option value="ARS">Pesos (ARS)</option>
        </Select>
      </label>
      <label className="label">Ambientes (mínimo)
        <input name="minRooms" type="number" min={0} inputMode="numeric" defaultValue={f.minRooms} className="input" />
      </label>
      <label className="label">Superficie mínima (m²)
        <input name="minArea" type="number" min={0} inputMode="numeric" defaultValue={f.minArea} className="input" />
      </label>
      <label className="label">Superficie máxima (m²)
        <input name="maxArea" type="number" min={0} inputMode="numeric" defaultValue={f.maxArea} className="input" />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button className="btn btn-primary">Buscar</button>
        <Link href="/propiedades" className="btn">Limpiar</Link>
      </div>
    </form>
  );
}
