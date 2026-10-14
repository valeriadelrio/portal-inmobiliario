import Link from "next/link";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { OPERATION_LABEL } from "@/lib/labels";
import { cachedActiveZones, cachedSearch } from "@/server/cache/public";
import { Bone, CardGridSkeleton } from "@/components/skeletons";

async function Latest() {
  const r = await cachedSearch(searchFilters.parse({}));
  if (!r.ok || r.data.items.length === 0) {
    return <p className="muted">Todavía no hay propiedades publicadas. ¡Volvé pronto!</p>;
  }
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {r.data.items.slice(0, 6).map((p, i) => <li key={p.id}><PublicCard p={p} priority={i < 3} /></li>)}
      </ul>
      <p className="mt-5 text-center"><Link href="/propiedades" className="btn">Ver todas las propiedades</Link></p>
    </>
  );
}

async function QuickSearch() {
  const zones = await cachedActiveZones();
  const list = zones.ok ? zones.data : [];
  return (
    <form method="get" action="/propiedades" className="card grid gap-3 sm:grid-cols-4">
      <label className="label">Operación
        <select name="op" className="input">
          <option value="">Venta y alquiler</option>
          {Object.entries(OPERATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="label">Zona o barrio
        <select name="zone" className="input">
          <option value="">Toda la ciudad</option>
          {list.map((z) => <option key={z.id} value={z.slug}>{z.nameEs}</option>)}
        </select>
      </label>
      <label className="label">Tipo
        <select name="type" className="input">
          <option value="">Todos</option>
          <option value="house">Casa</option><option value="apartment">Departamento</option><option value="lot">Lote</option>
          <option value="ph">PH</option><option value="commercial">Local comercial</option><option value="office">Oficina</option><option value="garage">Cochera</option>
        </select>
      </label>
      <div className="flex items-end"><button className="btn btn-primary w-full">Buscar</button></div>
    </form>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">Encontrá tu próxima casa o lote en Tandil</h1>
        <p className="muted text-lg">Propiedades de varias inmobiliarias en un solo lugar, en dólares y en pesos.</p>
        <Suspense fallback={<Bone className="h-28 w-full" />}><QuickSearch /></Suspense>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Publicaciones recientes</h2>
        <Suspense fallback={<CardGridSkeleton count={3} />}><Latest /></Suspense>
      </section>
    </main>
  );
}
