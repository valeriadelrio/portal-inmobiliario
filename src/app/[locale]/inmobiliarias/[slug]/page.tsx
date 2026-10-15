import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { searchFilters } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { getDict, isLocale, localePath, type Locale } from "@/i18n";
import { alternates } from "@/lib/seo";
import { searchQuery } from "@/lib/search-url";
import { whatsappUrl } from "@/lib/whatsapp";
import { cachedPublicAgency, cachedSearch } from "@/server/cache/public";
import { AgencySkeleton } from "@/components/skeletons";

type Params = Promise<{ locale: string; slug: string }>;
type SP = Promise<{ page?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).agency;
  const r = await cachedPublicAgency(slug);
  if (!r.ok || !r.data) return { title: t.notFoundTitle, robots: { index: false } };
  return {
    title: t.title(r.data.agency.name),
    description: (r.data.agency.description ?? t.metaDescription(r.data.agency.name)).slice(0, 155),
    alternates: alternates(`/inmobiliarias/${slug}`, locale),
  };
}

async function Agency({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ locale: loc, slug }, sp] = await Promise.all([params, searchParams]);
  if (!isLocale(loc)) notFound();
  const locale: Locale = loc;
  const d = getDict(locale);
  const t = d.agency;
  const base = localePath(locale, `/inmobiliarias/${slug}`);
  const a = await cachedPublicAgency(slug);
  if (!a.ok || !a.data) notFound();
  const f = searchFilters.parse({ agency: slug, page: sp.page });
  const props = await cachedSearch(f);
  const { agency, members } = a.data;
  const pages = props.ok ? Math.max(1, Math.ceil(props.data.total / props.data.pageSize)) : 1;

  return (
    <>
      <header className="card flex flex-wrap items-center gap-4">
        {agency.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logoUrl} alt={t.logoAlt(agency.name)} className="h-16 w-16 rounded object-contain" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{agency.name}</h1>
          {agency.description && <p className="muted mt-1 text-sm">{agency.description}</p>}
          <p className="muted mt-1 flex flex-wrap gap-x-4 text-sm">
            {agency.address && <span>{agency.address}</span>}
            {agency.phone && <span>{agency.phone}</span>}
            {agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className="link">{t.website}</a>}
          </p>
        </div>
      </header>

      {members.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">{t.team}</h2>
          <ul className="flex flex-wrap gap-3">
            {members.map((m) => {
              const wa = whatsappUrl(m.publicWhatsapp, t.whatsappText(m.displayName ?? ""));
              return (
                <li key={m.id} className="card flex items-center gap-3 py-3">
                  <span className="font-medium">{m.displayName ?? t.agentFallback}</span>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn px-3 py-1 text-xs">WhatsApp</a>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 font-medium">{t.properties} {props.ok ? `(${props.data.total})` : ""}</h2>
        {props.ok && props.data.items.length === 0 && <p className="muted text-sm">{t.noProperties}</p>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.ok && props.data.items.map((p) => <li key={p.id}><PublicCard p={p} locale={locale} /></li>)}
        </ul>
        {pages > 1 && props.ok && (
          <nav aria-label={d.search.pagination} className="mt-6 flex items-center justify-center gap-3">
            {props.data.page > 1 && <Link href={`${base}${searchQuery({}, { page: props.data.page - 1 })}`} className="btn">{d.search.previous}</Link>}
            <span className="muted text-sm">{d.search.pageOf(props.data.page, pages)}</span>
            {props.data.page < pages && <Link href={`${base}${searchQuery({}, { page: props.data.page + 1 })}`} className="btn">{d.search.next}</Link>}
          </nav>
        )}
      </section>
    </>
  );
}

export default function InmobiliariaPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Suspense fallback={<AgencySkeleton />}><Agency params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}
