import Link from "next/link";
import { Select } from "@/components/select";
import type { SearchFilters, ZoneDto } from "@/contracts";
import { PROPERTY_TYPE } from "@/contracts";
import { getDict, localePath, zoneLabel, type Locale } from "@/i18n";

/** Filtros del buscador: un <form method="get">, sin JavaScript. La URL resultante se puede compartir. */
export function SearchFiltersForm({ f, zones, locale }: { f: SearchFilters; zones: ZoneDto[]; locale: Locale }) {
  const d = getDict(locale);
  const t = d.search;
  const parents = zones.filter((z) => !z.parentId);
  const childrenOf = (id: string) => zones.filter((z) => z.parentId === id);
  const zone = f.zone?.[0] ?? "";
  const type = f.type?.[0] ?? "";
  const action = localePath(locale, "/propiedades");
  return (
    <form method="get" action={action} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="label">{t.operation}
        <Select name="op" defaultValue={f.op ?? ""} className="input">
          <option value="">{t.bothOperations}</option>
          {Object.entries(d.operations).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </label>
      <label className="label">{t.type}
        <Select name="type" defaultValue={type} className="input">
          <option value="">{t.allTypes}</option>
          {PROPERTY_TYPE.map((x) => <option key={x} value={x}>{d.types[x]}</option>)}
        </Select>
      </label>
      <label className="label">{t.zone}
        <Select name="zone" defaultValue={zone} className="input">
          <option value="">{t.wholeCity}</option>
          {parents.map((p) => {
            const name = zoneLabel(locale, p.nameEs, p.nameEn);
            return (
              <optgroup key={p.id} label={name}>
                <option value={p.slug}>{t.wholeZone(name)}</option>
                {childrenOf(p.id).map((c) => <option key={c.id} value={c.slug}>{zoneLabel(locale, c.nameEs, c.nameEn)}</option>)}
              </optgroup>
            );
          })}
        </Select>
      </label>
      <label className="label">{t.sort}
        <Select name="sort" defaultValue={f.sort} className="input">
          <option value="recent">{t.recent}</option>
          <option value="price_asc">{t.priceAsc}</option>
          <option value="price_desc">{t.priceDesc}</option>
        </Select>
      </label>
      <label className="label">{t.minPrice}
        <input name="minPrice" type="number" min={0} inputMode="numeric" defaultValue={f.minPrice} className="input" />
      </label>
      <label className="label">{t.maxPrice}
        <input name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={f.maxPrice} className="input" />
      </label>
      <label className="label">{t.currency}
        <Select name="currency" defaultValue={f.currency ?? ""} className="input">
          <option value="">{t.usd}</option>
          <option value="ARS">{t.ars}</option>
        </Select>
      </label>
      <label className="label">{t.minRooms}
        <input name="minRooms" type="number" min={0} inputMode="numeric" defaultValue={f.minRooms} className="input" />
      </label>
      <label className="label">{t.minArea}
        <input name="minArea" type="number" min={0} inputMode="numeric" defaultValue={f.minArea} className="input" />
      </label>
      <label className="label">{t.maxArea}
        <input name="maxArea" type="number" min={0} inputMode="numeric" defaultValue={f.maxArea} className="input" />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button className="btn btn-primary">{t.submit}</button>
        <Link href={action} className="btn">{t.clear}</Link>
      </div>
    </form>
  );
}
