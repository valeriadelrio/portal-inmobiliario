import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { getActor } from "@/server/auth/get-actor";
import { listAuditLog } from "@/server/services/moderation";

const ACTION_LABEL: Record<string, string> = {
  "agency.register": "Alta de inmobiliaria", "agency.approved": "Inmobiliaria aprobada", "agency.rejected": "Inmobiliaria rechazada",
  "agency.suspended": "Inmobiliaria suspendida", "property.hide": "Publicación ocultada", "property.unhide": "Publicación restituida",
  "report.dismiss": "Denuncia descartada", "report.hide": "Denuncia: publicación ocultada",
};
const FILTERS: [string, string][] = [["", "Todo"], ["agency.", "Inmobiliarias"], ["property.", "Propiedades"], ["report.", "Denuncias"]];
const fmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Registro({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const prefix = FILTERS.find(([v]) => v && v === sp.tipo)?.[0];
  const page = Math.max(1, Number(sp.pagina) || 1);
  const r = await listAuditLog(await getActor(), { prefix, page });
  if (!r.ok) return <p className="alert alert-error">No se pudo cargar el registro.</p>;
  const { items, total, pageSize } = r.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (tipo: string, pagina = 1) => {
    const p = new URLSearchParams();
    if (tipo) p.set("tipo", tipo);
    if (pagina > 1) p.set("pagina", String(pagina));
    return `/admin/registro${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <div>
        <Link href="/admin" className="link text-sm">← Administración</Link>
        <h1 className="mt-2 text-2xl font-semibold">Registro de acciones</h1>
      </div>
      <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={l} href={href(v)} aria-current={(prefix ?? "") === v ? "page" : undefined} className={`btn ${(prefix ?? "") === v ? "btn-primary" : ""}`}>{l}</Link>
        ))}
      </nav>
      {items.length === 0 && <p className="card muted text-sm">Todavía no hay acciones registradas.</p>}
      {items.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Cuándo</th><th className="p-3">Acción</th><th className="p-3">Quién</th><th className="p-3">Inmobiliaria</th><th className="p-3">Detalle</th></tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="whitespace-nowrap p-3">{fmt.format(new Date(e.at))}</td>
                  <td className="p-3">{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="p-3 break-all">{e.actorEmail ?? "—"}</td>
                  <td className="p-3">{e.agencyName ?? "—"}</td>
                  <td className="p-3">{e.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && <Link href={href(prefix ?? "", page - 1)} className="btn">← Anterior</Link>}
          <span className="muted text-sm">Página {page} de {pages}</span>
          {page < pages && <Link href={href(prefix ?? "", page + 1)} className="btn">Siguiente →</Link>}
        </div>
      )}
    </>
  );
}

export default function RegistroPage({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string }> }) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
      <Suspense fallback={<ListSkeleton />}><Registro searchParams={searchParams} /></Suspense>
    </main>
  );
}
