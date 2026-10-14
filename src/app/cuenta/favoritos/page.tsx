import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicCard } from "@/components/public/public-card";
import { RoleGate } from "@/components/role-gate";
import { CardGridSkeleton } from "@/components/skeletons";
import { getActor } from "@/server/auth/get-actor";
import { listFavorites } from "@/server/services/favorite";

export const metadata: Metadata = { title: "Mis favoritos", robots: { index: false } };

async function Favoritos() {
  const r = await listFavorites(await getActor());
  if (!r.ok) return <p className="alert alert-error">No pudimos cargar tus favoritos.</p>;
  if (r.data.length === 0) {
    return (
      <p className="card muted">
        Todavía no guardaste propiedades. Entrá a una ficha y tocá <strong>Guardar en favoritos</strong>.{" "}
        <Link href="/propiedades" className="link">Ver propiedades</Link>
      </p>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {r.data.map((p) => <PublicCard key={p.id} p={p} />)}
    </div>
  );
}

export default function FavoritosPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Mis favoritos</h1>
      <RoleGate require="user">
        <Suspense fallback={<CardGridSkeleton />}><Favoritos /></Suspense>
      </RoleGate>
    </main>
  );
}
