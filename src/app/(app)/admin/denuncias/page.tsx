import Link from "next/link";
import { Suspense } from "react";
import type { ReportReason, ReportStatus } from "@/contracts";
import { ListSkeleton } from "@/components/skeletons";
import { getDict } from "@/i18n";
import { getActor } from "@/server/auth/get-actor";
import { listReports } from "@/server/services/moderation";
import { ReportActions } from "./report-actions";

const STATUS_LABEL: Record<ReportStatus, string> = { open: "Abierta", dismissed: "Descartada", actioned: "Resuelta" };
const REASONS = getDict("es").report.reasons as Record<ReportReason, string>;
const fmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const FILTERS: [string, string][] = [["abiertas", "Abiertas"], ["todas", "Todas"]];

async function Denuncias({ searchParams }: { searchParams: Promise<{ ver?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const all = sp.ver === "todas";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const r = await listReports(await getActor(), { status: all ? undefined : "open", page });
  if (!r.ok) return <p className="alert alert-error">No se pudieron cargar las denuncias.</p>;
  const { items, total, openTotal, pageSize } = r.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (ver: string, pagina = 1) => `/admin/denuncias?ver=${ver}${pagina > 1 ? `&pagina=${pagina}` : ""}`;

  return (
    <>
      <div>
        <Link href="/admin" className="link text-sm">← Administración</Link>
        <h1 className="mt-2 text-2xl font-semibold">Denuncias</h1>
        <p className="muted text-sm">{openTotal} {openTotal === 1 ? "abierta" : "abiertas"}</p>
      </div>
      <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={href(v)} aria-current={(all ? "todas" : "abiertas") === v ? "page" : undefined}
            className={`btn ${(all ? "todas" : "abiertas") === v ? "btn-primary" : ""}`}>{l}</Link>
        ))}
      </nav>
      {items.length === 0 && <p className="card muted text-sm">No hay denuncias {all ? "" : "abiertas"}.</p>}
      {items.map((d) => (
        <section key={d.id} className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${d.status === "open" ? "badge-active" : "badge-off"}`}>{STATUS_LABEL[d.status]}</span>
            <strong>{REASONS[d.reason]}</strong>
            {d.openForProperty > 1 && d.status === "open" && <span className="badge badge-draft">{d.openForProperty} denuncias abiertas sobre esta ficha</span>}
            {d.moderationStatus === "hidden" && <span className="badge badge-off">Oculta</span>}
          </div>
          <p className="text-sm">
            <Link href={`/propiedades/${d.propertySlug}`} className="link" target="_blank" rel="noopener noreferrer">{d.propertyTitle}</Link>
            <span className="muted"> · {d.agencyName} · {fmt.format(new Date(d.createdAt))}</span>
          </p>
          {d.message && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{d.message}</p>}
          {d.reporterEmail && <p className="muted text-sm">Contacto del denunciante: {d.reporterEmail}</p>}
          {d.status === "open"
            ? <ReportActions id={d.id} alreadyHidden={d.moderationStatus === "hidden"} />
            : d.resolutionNote && <p className="muted text-sm">Nota: {d.resolutionNote}</p>}
        </section>
      ))}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && <Link href={href(all ? "todas" : "abiertas", page - 1)} className="btn">← Anterior</Link>}
          <span className="muted text-sm">Página {page} de {pages}</span>
          {page < pages && <Link href={href(all ? "todas" : "abiertas", page + 1)} className="btn">Siguiente →</Link>}
        </div>
      )}
    </>
  );
}

export default function DenunciasPage({ searchParams }: { searchParams: Promise<{ ver?: string; pagina?: string }> }) {
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <Suspense fallback={<ListSkeleton />}><Denuncias searchParams={searchParams} /></Suspense>
    </main>
  );
}
