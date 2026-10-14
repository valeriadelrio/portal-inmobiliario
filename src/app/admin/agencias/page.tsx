import { Suspense } from "react";
import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { listAgenciesForAdmin } from "@/server/services/agency";
import { StatusForm } from "./status-form";

const LABEL: Record<string, string> = { pending: "Pendiente", approved: "Aprobada", suspended: "Suspendida", rejected: "Rechazada" };
const FILTERS = [["", "Todas"], ["pending", "Pendientes"], ["approved", "Aprobadas"], ["suspended", "Suspendidas"], ["rejected", "Rechazadas"]];

async function Agencias({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const status = estado && estado in LABEL ? estado : undefined;
  const r = await listAgenciesForAdmin(await getActor(), status);
  if (!r.ok) return <p className="alert alert-error m-6">No se pudieron cargar las agencias.</p>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <Link href="/admin" className="link text-sm">← Administración</Link>
        <h1 className="mt-2 text-2xl font-semibold">Agencias</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <Link key={value} href={value ? `/admin/agencias?estado=${value}` : "/admin/agencias"}
            className={`btn ${(status ?? "") === value ? "btn-primary" : ""}`}>{label}</Link>
        ))}
      </div>
      {r.data.length === 0 && <p className="muted text-sm">No hay agencias en este estado.</p>}
      {r.data.map((a) => (
        <section key={a.id} className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{a.name}</h2>
            <span className="muted text-sm">/{a.slug}</span>
            <span className="badge">{LABEL[a.status] ?? a.status}</span>
          </div>
          <p className="muted text-sm">
            Registrada el {new Date(a.createdAt).toLocaleDateString("es-AR")}
            {a.phone && ` · ${a.phone}`}{a.email && ` · ${a.email}`}
            {a.statusReason && ` · Motivo: ${a.statusReason}`}
          </p>
          <StatusForm id={a.id} status={a.status} />
        </section>
      ))}
    </main>
  );
}

export default function AgenciasAdminPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  return (
    <Suspense fallback={<p className="muted mx-auto max-w-3xl px-6 py-8">Cargando…</p>}>
      <Agencias searchParams={searchParams} />
    </Suspense>
  );
}
