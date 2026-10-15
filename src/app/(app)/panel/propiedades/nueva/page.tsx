import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { listMembers } from "@/server/services/agency";
import { listActiveZones } from "@/server/services/zone";
import { PropertyForm } from "../property-form";
import { FormSkeleton } from "@/components/skeletons";

async function NewProperty() {
  const actor = await getActor();
  if (actor.kind === "anonymous" || !actor.membership) {
    return <p className="alert alert-error">Necesitás pertenecer a una inmobiliaria aprobada para cargar propiedades.</p>;
  }
  const zones = await listActiveZones(actor);
  if (!zones.ok || zones.data.length === 0) {
    return <p className="alert alert-error">Todavía no hay zonas cargadas. La administración del portal debe cargarlas primero.</p>;
  }
  const members = actor.membership.role === "agency_admin" ? await listMembers(actor) : null;
  const agents = members?.ok ? members.data.map((m) => ({ id: m.id, name: m.displayName ?? "Sin nombre" })) : undefined;
  return <div className="card"><PropertyForm zones={zones.data} agents={agents} /></div>;
}

export default function NuevaPropiedadPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <div>
        <Link href="/panel/propiedades" className="link text-sm">← Propiedades</Link>
        <h1 className="mt-2 text-2xl font-semibold">Nueva propiedad</h1>
        <p className="muted mt-1 text-sm">Se crea como borrador. Después podrás cargar las fotos y publicarla.</p>
      </div>
      <Suspense fallback={<FormSkeleton fields={8} heading={false} />}><NewProperty /></Suspense>
    </main>
  );
}
