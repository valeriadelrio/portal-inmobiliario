import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { listAllZones } from "@/server/services/zone";
import { DeleteZone, ImportForm, ZoneForm } from "./zone-forms";

export default async function ZonasPage() {
  const result = await listAllZones(await getActor());
  if (!result.ok) return <p className="alert alert-error m-6">No se pudieron cargar las zonas.</p>;
  const zones = result.data;
  const parents = zones.filter((z) => !z.parentId);
  const nameOf = new Map(zones.map((z) => [z.id, z.nameEs]));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <Link href="/admin" className="link text-sm">← Administración</Link>
        <h1 className="mt-2 text-2xl font-semibold">Zonas y barrios</h1>
        <p className="muted mt-1 text-sm">
          Las zonas con “(a confirmar)” son de ejemplo. Una zona en uso no se borra: desactivala.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-medium">Nueva zona</h2>
        <ZoneForm parents={parents} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Importar desde CSV</h2>
        <p className="muted text-sm">
          Columnas: <code>slug,name_es,name_en,parent_slug,sort_order,is_active</code>. Crea o actualiza por slug; si una fila falla, no se aplica ninguna.
        </p>
        <ImportForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Zonas ({zones.length})</h2>
        {zones.length === 0 && <p className="muted text-sm">Todavía no hay zonas.</p>}
        {zones.map((z) => (
          <details key={z.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-medium">{z.nameEs}</span>
              <span className="muted text-sm">{z.slug}</span>
              {z.parentId && <span className="badge">dentro de {nameOf.get(z.parentId)}</span>}
              {!z.isActive && <span className="badge badge-off">inactiva</span>}
            </summary>
            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
              <ZoneForm zone={z} parents={parents} />
              <DeleteZone id={z.id} />
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
