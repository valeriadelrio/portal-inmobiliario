import Link from "next/link";
import { Suspense } from "react";
import { INQUIRY_STATUS, type InquiryStatus } from "@/contracts";
import { ListSkeleton } from "@/components/skeletons";
import { getActor } from "@/server/auth/get-actor";
import { listInquiries } from "@/server/services/inquiry";
import { StatusButtons } from "./status-buttons";

const STATUS_LABEL: Record<InquiryStatus, string> = { new: "Nueva", read: "Leída", answered: "Respondida", archived: "Archivada" };
const STATUS_CLASS: Record<InquiryStatus, string> = { new: "badge-active", read: "badge-draft", answered: "badge-sold_rented", archived: "badge-off" };
const fmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Consultas({ searchParams }: { searchParams: Promise<{ estado?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const status = INQUIRY_STATUS.find((s) => s === sp.estado);
  const page = Math.max(1, Number(sp.pagina) || 1);
  const actor = await getActor();
  const r = await listInquiries(actor, { status, page });
  if (!r.ok) {
    return <p className="alert alert-error">La bandeja está disponible para integrantes de una inmobiliaria aprobada.</p>;
  }
  const { items, total, unread, pageSize } = r.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = actor.kind === "user" && actor.membership?.role === "agency_admin";
  const href = (o: { estado?: string; pagina?: number }) => {
    const q = new URLSearchParams();
    if (o.estado) q.set("estado", o.estado);
    if (o.pagina && o.pagina > 1) q.set("pagina", String(o.pagina));
    return `/panel/consultas${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <p className="muted text-sm">{unread} {unread === 1 ? "nueva" : "nuevas"}{isAdmin ? " · de toda tu inmobiliaria" : ""}</p>
      </div>
      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {[{ s: undefined, l: "Todas" }, ...INQUIRY_STATUS.map((s) => ({ s, l: STATUS_LABEL[s] }))].map(({ s, l }) => (
          <Link key={l} href={href({ estado: s })} aria-current={s === status ? "page" : undefined}
            className={`btn text-sm ${s === status ? "border-blue-700 bg-blue-100 text-blue-900" : ""}`}>{l}</Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="card muted">{status ? "No hay consultas con ese estado." : "Todavía no recibiste consultas. Cuando alguien escriba desde una ficha, la vas a ver acá y te llegará un email."}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((q) => (
            <li key={q.id} className={`card space-y-3 ${q.status === "new" ? "border-blue-700" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{q.name} <span className={`badge ${STATUS_CLASS[q.status]}`}>{STATUS_LABEL[q.status]}</span></p>
                  <p className="muted text-sm">
                    {fmt.format(new Date(q.createdAt))} · por <Link className="link" href={`/propiedades/${q.propertySlug}`}>{q.propertyTitle}</Link>
                    {isAdmin && q.agentName ? ` · agente: ${q.agentName}` : ""}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-line">{q.message}</p>
              <p className="text-sm">
                <a className="link" href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.propertyTitle}`)}`}>{q.email}</a>
                {q.phone && <> · <a className="link" href={`tel:${q.phone.replace(/[^\d+]/g, "")}`}>{q.phone}</a></>}
              </p>
              <StatusButtons id={q.id} current={q.status} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? <Link className="btn" href={href({ estado: status, pagina: page - 1 })}>← Anteriores</Link> : <span />}
          <span className="muted text-sm">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn" href={href({ estado: status, pagina: page + 1 })}>Siguientes →</Link> : <span />}
        </div>
      )}
    </>
  );
}

export default function ConsultasPage({ searchParams }: { searchParams: Promise<{ estado?: string; pagina?: string }> }) {
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <Suspense fallback={<ListSkeleton />}><Consultas searchParams={searchParams} /></Suspense>
    </main>
  );
}
