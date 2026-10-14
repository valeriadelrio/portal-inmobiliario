import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { SearchFiltersForm } from "@/components/public/search-filters";
import { searchQuery } from "@/lib/search-url";
import { cachedActiveZones, cachedSearch } from "@/server/cache/public";

export const metadata: Metadata = {
  title: "Propiedades y lotes en Tandil",
  description: "Casas, departamentos, lotes y más en venta y alquiler en Tandil, de varias inmobiliarias.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

async function Results({ searchParams }: { searchParams: SP }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = searchFilters.safeParse(raw);
  const f = parsed.success ? parsed.data : searchFilters.parse({});
  const [zones, r] = await Promise.all([cachedActiveZones(), cachedSearch(f)]);
  const pages = r.ok ? Math.max(1, Math.ceil(r.data.total / r.data.pageSize)) : 1;

  return (
    <>
      <SearchFiltersForm f={f} zones={zones.ok ? zones.data : []} />
      {!parsed.success && <p className="alert alert-error mt-4">Algunos filtros no eran válidos y se ignoraron.</p>}
      {!r.ok ? (
        <p className="alert alert-error mt-4">No se pudieron cargar las propiedades. Probá de nuevo en un momento.</p>
      ) : (
        <>
          <p className="muted mt-5 text-sm" aria-live="polite">
            {r.data.total === 0 ? "No encontramos propiedades con esos filtros." : `${r.data.total} ${r.data.total === 1 ? "propiedad" : "propiedades"}`}
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {r.data.items.map((p, i) => <li key={p.id}><PublicCard p={p} priority={i < 3} /></li>)}
          </ul>
          {pages > 1 && (
            <nav aria-label="Paginación" className="mt-6 flex items-center justify-center gap-3">
              {r.data.page > 1 && <Link href={`/propiedades${searchQuery(f, { page: r.data.page - 1 })}`} className="btn">← Anterior</Link>}
              <span className="muted text-sm">Página {r.data.page} de {pages}</span>
              {r.data.page < pages && <Link href={`/propiedades${searchQuery(f, { page: r.data.page + 1 })}`} className="btn">Siguiente →</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}

export default function PropiedadesPublicPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Propiedades y lotes en Tandil</h1>
      <Suspense fallback={<p className="muted">Cargando…</p>}><Results searchParams={searchParams} /></Suspense>
    </main>
  );
}
