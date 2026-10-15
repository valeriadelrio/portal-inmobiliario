import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicCard } from "@/components/public/public-card";
import { getDict, isLocale, localePath, type Locale } from "@/i18n";
import { RoleGate } from "@/components/role-gate";
import { CardGridSkeleton } from "@/components/skeletons";
import { getActor } from "@/server/auth/get-actor";
import { listFavorites } from "@/server/services/favorite";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).favorites.title : undefined, robots: { index: false } };
}

async function Favoritos({ locale }: { locale: Locale }) {
  const t = getDict(locale).favorites;
  const r = await listFavorites(await getActor());
  if (!r.ok) return <p className="alert alert-error">{t.loadError}</p>;
  if (r.data.length === 0) {
    return (
      <p className="card muted">
        {t.empty} <strong>{t.emptyAction}</strong>.{" "}
        <Link href={localePath(locale, "/propiedades")} className="link">{getDict(locale).site.seeProperties}</Link>
      </p>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {r.data.map((p) => <PublicCard key={p.id} p={p} locale={locale} />)}
    </div>
  );
}

export default async function FavoritosPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">{getDict(locale).favorites.title}</h1>
      <RoleGate require="user">
        <Suspense fallback={<CardGridSkeleton />}><Favoritos locale={locale} /></Suspense>
      </RoleGate>
    </main>
  );
}
