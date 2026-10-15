import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { statusLabel } from "@/lib/labels";
import { getActor } from "@/server/auth/get-actor";
import { listPropertiesForModeration } from "@/server/services/moderation";
import { ModerateForm } from "./moderate-form";

type SP = Promise<{ q?: string; ocultas?: string; pagina?: string }>;

async function Propiedades({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const hidden = sp.ocultas === "1";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const r = await listPropertiesForModeration(await getActor(), { q, hidden, page });
  if (!r.ok) return <p className="alert alert-error">No se pudieron cargar las propiedades.</p>;
  const { items, total, pageSize } = r.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (pagina: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (hidden) p.set("ocultas", "1");
    if (pagina > 1) p.set("pagina", String(pagina));
    return `/admin/propiedades${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <div>
        <Link href="/admin" className="link text-sm">← Administración</Link>
        <h1 className="mt-2 text-2xl font-semibold">Moderar propiedades</h1>
        <p className="muted text-sm">Ocultar una ficha la saca del sitio público; la inmobiliaria la sigue viendo con el motivo y no puede volver a mostrarla.</p>
      </div>
      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Título, dirección web o inmobiliaria" className="input w-72" aria-label="Buscar" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ocultas" value="1" defaultChecked={hidden} /> Solo ocultas</label>
        <button className="btn btn-primary">Buscar</button>
      </form>
      <p className="muted text-sm">{total} {total === 1 ? "resultado" : "resultados"}</p>
      {items.length === 0 && <p className="card muted text-sm">No hay propiedades con estos filtros.</p>}
      {items.map((p) => (
        <section key={p.id} className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/propiedades/${p.slug}`} className="link font-medium" target="_blank" rel="noopener noreferrer">{p.title}</Link>
            <span className="badge">{statusLabel(p.status, "sale")}</span>
            {p.moderationStatus === "hidden" && <span className="badge badge-off">Oculta</span>}
            {p.openReports > 0 && <span className="badge badge-draft">{p.openReports} {p.openReports === 1 ? "denuncia abierta" : "denuncias abiertas"}</span>}
          </div>
          <p className="muted text-sm">{p.agencyName}{p.moderationReason && ` · Motivo: ${p.moderationReason}`}</p>
          <ModerateForm id={p.id} hidden={p.moderationStatus === "hidden"} />
        </section>
      ))}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && <Link href={href(page - 1)} className="btn">← Anterior</Link>}
          <span className="muted text-sm">Página {page} de {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="btn">Siguiente →</Link>}
        </div>
      )}
    </>
  );
}

export default function PropiedadesAdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <Suspense fallback={<ListSkeleton />}><Propiedades searchParams={searchParams} /></Suspense>
    </main>
  );
}
