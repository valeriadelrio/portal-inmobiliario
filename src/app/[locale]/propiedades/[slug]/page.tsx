import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "@/components/public/gallery";
import { StatusBadge } from "@/components/status-badge";
import { getDict, isLocale, localePath, zoneLabel, type Locale } from "@/i18n";
import { formatPrice } from "@/lib/labels";
import { photoUrl } from "@/lib/photo-url";
import { propertyFacts } from "@/lib/property-facts";
import { alternates } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { cachedPublicProperty } from "@/server/cache/public";
import { FichaSkeleton, Bone } from "@/components/skeletons";
import { FavoriteSlot, InquirySlot } from "@/components/public/ficha-actions";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const d = getDict(locale);
  const r = await cachedPublicProperty(slug);
  if (!r.ok || !r.data) return { title: d.ficha.notFoundTitle, robots: { index: false } };
  const p = r.data;
  const type = d.types[p.type] ?? p.type;
  const title = d.ficha.metaTitle(p.title, type, (d.operations[p.operation] ?? p.operation).toLowerCase(), zoneLabel(locale, p.zoneName, p.zoneNameEn));
  const description = `${formatPrice(p.price, p.currency, locale)} · ${p.totalAreaM2} m² · ${p.description}`.slice(0, 155);
  return {
    title, description,
    alternates: alternates(`/propiedades/${p.slug}`, locale),
    openGraph: { title, description, type: "website", images: p.coverKey ? [{ url: photoUrl(p.coverKey, 1600) }] : undefined },
  };
}

const AVAILABILITY = { active: "InStock", reserved: "LimitedAvailability", sold_rented: "SoldOut" } as Record<string, string>;
/** JSON-LD seguro para incrustar en HTML (evita cerrar el <script> con "<"). */
const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

async function Ficha({ params }: { params: Params }) {
  const { locale: loc, slug } = await params;
  if (!isLocale(loc)) notFound();
  const locale: Locale = loc;
  const d = getDict(locale);
  const t = d.ficha;
  const r = await cachedPublicProperty(slug);
  if (!r.ok || !r.data) notFound();
  const p = r.data;
  const url = `${siteUrl()}${localePath(locale, `/propiedades/${p.slug}`)}`;
  const zone = zoneLabel(locale, p.zoneName, p.zoneNameEn);
  const parentZone = p.zoneParentName ? zoneLabel(locale, p.zoneParentName, p.zoneParentNameEn) : null;
  const type = d.types[p.type] ?? p.type;
  const money = (n: number) => formatPrice(n, p.currency, locale);
  const facts = propertyFacts(
    { ...(p.detail.kind === "lot" ? { type: "lot", ...p.detail } : { type: p.type, ...p.detail }), totalAreaM2: p.totalAreaM2, coveredAreaM2: p.coveredAreaM2 ?? undefined,
      expenses: p.expenses ?? undefined, currency: p.currency, addressText: p.address ?? undefined, showExactAddress: true },
    money, locale,
  );
  const wa = whatsappUrl(p.agent?.publicWhatsapp, t.whatsappText(p.agent?.displayName ?? null, p.title, url));
  const closed = p.status !== "active";

  const ld = {
    "@context": "https://schema.org", "@type": "RealEstateListing", name: p.title, description: p.description, url,
    datePosted: p.publishedAt ?? undefined,
    image: p.photos.slice(0, 5).map((ph) => photoUrl(ph.storageKey, 1600)),
    offers: { "@type": "Offer", price: p.price, priceCurrency: p.currency, availability: `https://schema.org/${AVAILABILITY[p.status] ?? "InStock"}` },
    about: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Tandil", addressRegion: "Buenos Aires", addressCountry: "AR", streetAddress: p.address ?? undefined } },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <nav aria-label={t.breadcrumb} className="muted text-sm">
        <Link href={localePath(locale, "/propiedades")} className="link">{d.site.properties}</Link> › {parentZone ? `${parentZone} › ` : ""}{zone}
      </nav>

      {closed && (
        <p role="status" className="alert alert-error mt-3 text-base">
          <strong>{t.closed(p.status === "reserved" ? d.status.reservedNotice : p.operation === "rent" ? d.status.rentedNotice : d.status.soldNotice)}</strong>{p.status === "reserved" ? t.reservedHint : t.goneHint}
        </p>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Gallery photos={p.photos} title={p.title} locale={locale} />
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-blue-700 text-white">{d.operations[p.operation] ?? p.operation}</span>
              {closed && <StatusBadge status={p.status} operation={p.operation} locale={locale} />}
              <span className="muted text-sm">{type} · {zone}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">{p.title}</h1>
            <p className="mt-1 text-3xl font-semibold">{money(p.price)}</p>
            <p lang={p.language} className="mt-4 whitespace-pre-line leading-relaxed">{p.description}</p>
          </section>
          <section className="card">
            <h2 className="mb-3 font-medium">{t.features}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {facts.map(([k, v]) => <div key={k} className="contents"><dt className="muted">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card space-y-3">
            <h2 className="font-medium">{t.contact}</h2>
            {p.agent ? (
              <div className="flex items-center gap-3">
                {p.agent.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.agent.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                )}
                <div>
                  <p className="font-medium">{p.agent.displayName ?? t.agentFallback}</p>
                  <p className="muted text-sm">{p.agencyName}</p>
                </div>
              </div>
            ) : (
              <p className="muted text-sm">{p.agencyName}</p>
            )}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">{t.whatsapp}</a>}
            {p.agent?.publicPhone && <p className="text-sm">{t.phone}: <a className="link" href={`tel:${p.agent.publicPhone.replace(/[^\d+]/g, "")}`}>{p.agent.publicPhone}</a></p>}
            {p.agent?.publicEmail && <p className="text-sm break-all">{t.email}: {p.agent.publicEmail}</p>}
            {!wa && !p.agent?.publicPhone && !p.agent?.publicEmail && <p className="muted text-sm">{t.contactSoon}</p>}
          </section>
          <section className="card space-y-3">
            <h2 className="font-medium">{t.sendInquiry}</h2>
            <Suspense fallback={<Bone className="h-64 w-full" />}><InquirySlot propertyId={p.id} title={p.title} locale={locale} open={p.status === "active" || p.status === "reserved"} /></Suspense>
          </section>
          <Suspense fallback={<Bone className="h-10 w-full" />}><FavoriteSlot propertyId={p.id} slug={p.slug} locale={locale} /></Suspense>
          <section className="card space-y-1">
            <p className="font-medium">{p.agency.name}</p>
            {p.agency.phone && <p className="muted text-sm">{p.agency.phone}</p>}
            <Link href={localePath(locale, `/inmobiliarias/${p.agency.slug}`)} className="link text-sm">{t.seeAllOfAgency}</Link>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function FichaPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <Suspense fallback={<FichaSkeleton />}><Ficha params={params} /></Suspense>
    </main>
  );
}
