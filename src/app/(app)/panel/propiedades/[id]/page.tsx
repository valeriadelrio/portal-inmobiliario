import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { listPhotos } from "@/server/services/photo";
import { getProperty } from "@/server/services/property";
import { listActiveZones } from "@/server/services/zone";
import { PhotoManager } from "../photo-manager";
import { PropertyForm } from "../property-form";
import { StatusPanel } from "../status-panel";
import { PropertyDetailSkeleton } from "@/components/skeletons";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const actor = await getActor();
  const r = await getProperty(actor, id);
  if (!r.ok) notFound();
  const zones = await listActiveZones(actor);
  const p = r.data;
  const photos = await listPhotos(actor, id);
  return (
    <>
      <div>
        <Link href="/panel/propiedades" className="link text-sm">← Propiedades</Link>
        <h1 className="mt-2 text-2xl font-semibold">{p.title}</h1>
        <p className="muted text-sm">Identificador de la ficha: {p.slug}</p>
      </div>
      {p.moderationStatus === "hidden" && (
        <p role="alert" className="alert alert-error">
          La administración del portal ocultó esta publicación{p.moderationReason ? `: ${p.moderationReason}` : "."} No se ve en el sitio público.
          Si querés que la revisen de nuevo, corregí lo indicado y escribinos.
        </p>
      )}
      <section className="card space-y-3">
        <h2 className="font-medium">Estado</h2>
        <StatusPanel id={p.id} status={p.status} operation={p.operation} blockers={p.blockers} />
      </section>
      <section className="card space-y-3">
        <h2 className="font-medium">Fotos</h2>
        <p className="muted text-sm">Para publicar se necesitan al menos 3 fotos y una portada. Podés reordenarlas con las flechas.</p>
        <PhotoManager propertyId={p.id} photos={photos.ok ? photos.data : []} />
      </section>
      <section className="card space-y-3">
        <h2 className="font-medium">Datos de la propiedad</h2>
        <PropertyForm zones={zones.ok ? zones.data : []} initial={p} />
      </section>
    </>
  );
}

export default function PropiedadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <Suspense fallback={<PropertyDetailSkeleton />}><Detail params={params} /></Suspense>
    </main>
  );
}
