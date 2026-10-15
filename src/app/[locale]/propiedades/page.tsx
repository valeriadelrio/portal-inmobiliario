import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { SearchFiltersForm } from "@/components/public/search-filters";
import { SearchSkeleton } from "@/components/skeletons";
import { getDict, isLocale, localePath, type Locale } from "@/i18n";
import { searchQuery } from "@/lib/search-url";
import { alternates } from "@/lib/seo";
import { cachedActiveZones, cachedSearch } from "@/server/cache/public";

type Params = Promise<{ locale: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).search;
  return { title: t.title, description: t.metaDescription, alternates: alternates("/propiedades", locale) };
}

async function Results({ searchParams, locale }: { searchParams: SP; locale: Locale }) {
  const t = getDict(locale).search;
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = searchFilters.safeParse(raw);
  const f = parsed.success ? parsed.data : searchFilters.parse({});
  const [zones, r] = await Promise.all([cachedActiveZones(), cachedSearch(f)]);
  const pages = r.ok ? Math.max(1, Math.ceil(r.data.total / r.data.pageSize)) : 1;
  const base = localePath(locale, "/propiedades");

  return (
    <>
      <SearchFiltersForm f={f} zones={zones.ok ? zones.data : []} locale={locale} />
      {!parsed.success && <p className="alert alert-error mt-4">{t.invalidFilters}</p>}
      {!r.ok ? (
        <p className="alert alert-error mt-4">{t.loadError}</p>
      ) : (
        <>
          <p className="muted mt-5 text-sm" aria-live="polite">{r.data.total === 0 ? t.none : t.count(r.data.total)}</p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {r.data.items.map((p, i) => <li key={p.id}><PublicCard p={p} locale={locale} priority={i < 3} /></li>)}
          </ul>
          {pages > 1 && (
            <nav aria-label={t.pagination} className="mt-6 flex items-center justify-center gap-3">
              {r.data.page > 1 && <Link href={`${base}${searchQuery(f, { page: r.data.page - 1 })}`} className="btn">{t.previous}</Link>}
              <span className="muted text-sm">{t.pageOf(r.data.page, pages)}</span>
              {r.data.page < pages && <Link href={`${base}${searchQuery(f, { page: r.data.page + 1 })}`} className="btn">{t.next}</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}

export default async function PropiedadesPublicPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">{getDict(locale).search.title}</h1>
      <Suspense fallback={<SearchSkeleton />}><Results searchParams={searchParams} locale={locale} /></Suspense>
    </main>
  );
}
