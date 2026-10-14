import Link from "next/link";
import { Suspense } from "react";
import { PROPERTY_STATUS, type PropertyStatus } from "@/contracts";
import { OPERATION_LABEL, statusLabel } from "@/lib/labels";
import { getActor } from "@/server/auth/get-actor";
import { listMyProperties } from "@/server/services/property";
import { PropertyCard } from "./property-card";
import { CardGridSkeleton } from "@/components/skeletons";

type SP = Promise<{ estado?: string; operacion?: string; pagina?: string }>;

async function Properties({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = (PROPERTY_STATUS as readonly string[]).includes(sp.estado ?? "") ? (sp.estado as PropertyStatus) : undefined;
  const operation = sp.operacion === "sale" || sp.operacion === "rent" ? sp.operacion : undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const actor = await getActor();
  const r = await listMyProperties(actor, { status, operation, page });
  if (!r.ok) {
    return <p className="alert alert-error">Las propiedades están disponibles para integrantes de una inmobiliaria aprobada.</p>;
  }
  const { items, total, pageSize } = r.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = actor.kind === "user" && actor.membership?.role === "agency_admin";
  const href = (o: { estado?: string; operacion?: string; pagina?: number }) => {
    const q = new URLSearchParams();
    const e = "estado" in o ? o.estado : status;
    const op = "operacion" in o ? o.operacion : operation;
    if (e) q.set("estado", e);
    if (op) q.set("operacion", op);
    if (o.pagina && o.pagina > 1) q.set("pagina", String(o.pagina));
    return `/panel/propiedades${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ estado: undefined })} className={`btn ${!status ? "btn-primary" : ""}`}>Todas</Link>
        {PROPERTY_STATUS.map((s) => (
          <Link key={s} href={href({ estado: s })} className={`btn ${status === s ? "btn-primary" : ""}`}>{statusLabel(s, "sale")}</Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-slate-300 sm:block" />
        <Link href={href({ operacion: undefined })} className={`btn ${!operation ? "btn-primary" : ""}`}>Venta y alquiler</Link>
        {Object.entries(OPERATION_LABEL).map(([k, l]) => (
          <Link key={k} href={href({ operacion: k })} className={`btn ${operation === k ? "btn-primary" : ""}`}>{l}</Link>
        ))}
      </div>

      <p className="muted mt-4 text-sm">{total} {total === 1 ? "propiedad" : "propiedades"}{isAdmin ? " en tu inmobiliaria" : " tuyas"}</p>
      {items.length === 0 && (
        <p className="card muted mt-3 text-sm">No hay propiedades con estos filtros. Creá la primera con “Nueva propiedad”.</p>
      )}
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <li key={p.id}><PropertyCard p={p} /></li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          {page > 1 && <Link href={href({ pagina: page - 1 })} className="btn">← Anterior</Link>}
          <span className="muted text-sm">Página {page} de {pages}</span>
          {page < pages && <Link href={href({ pagina: page + 1 })} className="btn">Siguiente →</Link>}
        </div>
      )}
    </>
  );
}

export default function PropiedadesPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Propiedades</h1>
        <Link href="/panel/propiedades/nueva" className="btn btn-primary">Nueva propiedad</Link>
      </div>
      <Suspense fallback={<CardGridSkeleton />}><Properties searchParams={searchParams} /></Suspense>
    </main>
  );
}
