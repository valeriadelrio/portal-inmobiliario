import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { Select } from "@/components/select";
import { Bone, CardGridSkeleton } from "@/components/skeletons";
import { PROPERTY_TYPE } from "@/contracts";
import { getDict, isLocale, localePath, zoneLabel, type Locale } from "@/i18n";
import { alternates } from "@/lib/seo";
import { cachedActiveZones, cachedSearch } from "@/server/cache/public";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { alternates: alternates("/", locale) };
}

async function Latest({ locale }: { locale: Locale }) {
  const t = getDict(locale).home;
  const r = await cachedSearch(searchFilters.parse({}));
  if (!r.ok || r.data.items.length === 0) return <p className="muted">{t.empty}</p>;
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {r.data.items.slice(0, 6).map((p, i) => <li key={p.id}><PublicCard p={p} locale={locale} priority={i < 3} /></li>)}
      </ul>
      <p className="mt-5 text-center"><Link href={localePath(locale, "/propiedades")} className="btn">{t.seeAll}</Link></p>
    </>
  );
}

async function QuickSearch({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const zones = await cachedActiveZones();
  const list = zones.ok ? zones.data : [];
  return (
    <form method="get" action={localePath(locale, "/propiedades")} className="card grid gap-3 sm:grid-cols-4">
      <label className="label">{d.search.operation}
        <Select name="op" className="input">
          <option value="">{d.search.bothOperations}</option>
          {Object.entries(d.operations).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </label>
      <label className="label">{d.search.zone}
        <Select name="zone" className="input">
          <option value="">{d.search.wholeCity}</option>
          {list.map((z) => <option key={z.id} value={z.slug}>{zoneLabel(locale, z.nameEs, z.nameEn)}</option>)}
        </Select>
      </label>
      <label className="label">{d.search.type}
        <Select name="type" className="input">
          <option value="">{d.search.allTypes}</option>
          {PROPERTY_TYPE.map((x) => <option key={x} value={x}>{d.types[x]}</option>)}
        </Select>
      </label>
      <div className="flex items-end"><button className="btn btn-primary w-full">{d.home.search}</button></div>
    </form>
  );
}

export default async function Home({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale).home;
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t.title}</h1>
        <p className="muted text-lg">{t.subtitle}</p>
        <Suspense fallback={<Bone className="h-28 w-full" />}><QuickSearch locale={locale} /></Suspense>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.recent}</h2>
        <Suspense fallback={<CardGridSkeleton count={3} />}><Latest locale={locale} /></Suspense>
      </section>
    </main>
  );
}
