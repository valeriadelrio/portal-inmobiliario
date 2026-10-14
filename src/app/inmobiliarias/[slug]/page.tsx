import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { searchQuery } from "@/lib/search-url";
import { whatsappUrl } from "@/lib/whatsapp";
import { cachedPublicAgency, cachedSearch } from "@/server/cache/public";

type Params = Promise<{ slug: string }>;
type SP = Promise<{ page?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const r = await cachedPublicAgency(slug);
  if (!r.ok || !r.data) return { title: "Inmobiliaria no encontrada", robots: { index: false } };
  return {
    title: `${r.data.agency.name} — propiedades en Tandil`,
    description: (r.data.agency.description ?? `Propiedades de ${r.data.agency.name} en Tandil.`).slice(0, 155),
  };
}

async function Agency({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const a = await cachedPublicAgency(slug);
  if (!a.ok || !a.data) notFound();
  const f = searchFilters.parse({ agency: slug, page: sp.page });
  const props = await cachedSearch(f);
  const { agency, members } = a.data;
  const pages = props.ok ? Math.max(1, Math.ceil(props.data.total / props.data.pageSize)) : 1;

  return (
    <>
      <header className="card flex flex-wrap items-center gap-4">
        {agency.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logoUrl} alt={`Logo de ${agency.name}`} className="h-16 w-16 rounded object-contain" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{agency.name}</h1>
          {agency.description && <p className="muted mt-1 text-sm">{agency.description}</p>}
          <p className="muted mt-1 flex flex-wrap gap-x-4 text-sm">
            {agency.address && <span>{agency.address}</span>}
            {agency.phone && <span>{agency.phone}</span>}
            {agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className="link">Sitio web</a>}
          </p>
        </div>
      </header>

      {members.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Equipo</h2>
          <ul className="flex flex-wrap gap-3">
            {members.map((m) => {
              const wa = whatsappUrl(m.publicWhatsapp, `Hola ${m.displayName ?? ""}, te escribo desde el portal de propiedades.`);
              return (
                <li key={m.id} className="card flex items-center gap-3 py-3">
                  <span className="font-medium">{m.displayName ?? "Agente"}</span>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn px-3 py-1 text-xs">WhatsApp</a>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 font-medium">Propiedades {props.ok ? `(${props.data.total})` : ""}</h2>
        {props.ok && props.data.items.length === 0 && <p className="muted text-sm">Por ahora no tiene propiedades publicadas.</p>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.ok && props.data.items.map((p) => <li key={p.id}><PublicCard p={p} /></li>)}
        </ul>
        {pages > 1 && props.ok && (
          <nav aria-label="Paginación" className="mt-6 flex items-center justify-center gap-3">
            {props.data.page > 1 && <Link href={`/inmobiliarias/${slug}${searchQuery({}, { page: props.data.page - 1 })}`} className="btn">← Anterior</Link>}
            <span className="muted text-sm">Página {props.data.page} de {pages}</span>
            {props.data.page < pages && <Link href={`/inmobiliarias/${slug}${searchQuery({}, { page: props.data.page + 1 })}`} className="btn">Siguiente →</Link>}
          </nav>
        )}
      </section>
    </>
  );
}

export default function InmobiliariaPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Suspense fallback={<p className="muted">Cargando…</p>}><Agency params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}
