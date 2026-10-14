import { getActor } from "@/server/auth/get-actor";
import { listAllZones } from "@/server/services/zone";
import { DeleteZone, ImportForm, ZoneForm } from "./zone-forms";

export default async function ZonasPage() {
  const result = await listAllZones(await getActor());
  if (!result.ok) return <p className="p-6 text-red-700">No se pudieron cargar las zonas.</p>;
  const zones = result.data;
  const parents = zones.filter((z) => !z.parentId);
  const nameOf = new Map(zones.map((z) => [z.id, z.nameEs]));

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Zonas y barrios</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Las zonas con “(a confirmar)” son de ejemplo. Una zona en uso no se borra: desactivala.
          Formato del CSV: <code>slug,name_es,name_en,parent_slug,sort_order,is_active</code> (alta o actualización por slug).
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Nueva zona</h2>
        <ZoneForm parents={parents} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Importar desde CSV</h2>
        <ImportForm />
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Zonas ({zones.length})</h2>
        {zones.length === 0 && <p className="text-sm text-zinc-500">Todavía no hay zonas.</p>}
        {zones.map((z) => (
          <details key={z.id} className="rounded border border-zinc-200 p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{z.nameEs}</span>{" "}
              <span className="text-zinc-500">
                {z.slug}{z.parentId ? ` · dentro de ${nameOf.get(z.parentId)}` : ""}{z.isActive ? "" : " · inactiva"}
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <ZoneForm zone={z} parents={parents} />
              <DeleteZone id={z.id} />
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
