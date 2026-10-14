import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "@/components/public/gallery";
import { StatusBadge } from "@/components/status-badge";
import { formatPrice, OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";
import { photoUrl } from "@/lib/photo-url";
import { propertyFacts } from "@/lib/property-facts";
import { siteUrl } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { cachedPublicProperty } from "@/server/cache/public";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const r = await cachedPublicProperty(slug);
  if (!r.ok || !r.data) return { title: "Propiedad no encontrada", robots: { index: false } };
  const p = r.data;
  const title = `${p.title} — ${TYPE_LABEL[p.type] ?? p.type} en ${OPERATION_LABEL[p.operation]?.toLowerCase()} en ${p.zoneName}`;
  const description = `${formatPrice(p.price, p.currency)} · ${p.totalAreaM2} m² · ${p.description}`.slice(0, 155);
  return {
    title, description,
    alternates: { canonical: `/propiedades/${p.slug}` },
    openGraph: { title, description, type: "website", images: p.coverKey ? [{ url: photoUrl(p.coverKey, 1600) }] : undefined },
  };
}

const AVAILABILITY = { active: "InStock", reserved: "LimitedAvailability", sold_rented: "SoldOut" } as Record<string, string>;
/** JSON-LD seguro para incrustar en HTML (evita cerrar el <script> con "<"). */
const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

async function Ficha({ params }: { params: Params }) {
  const { slug } = await params;
  const r = await cachedPublicProperty(slug);
  if (!r.ok || !r.data) notFound();
  const p = r.data;
  const url = `${siteUrl()}/propiedades/${p.slug}`;
  const money = (n: number) => formatPrice(n, p.currency);
  const facts = propertyFacts(
    { ...(p.detail.kind === "lot" ? { type: "lot", ...p.detail } : { type: p.type, ...p.detail }), totalAreaM2: p.totalAreaM2, coveredAreaM2: p.coveredAreaM2 ?? undefined,
      expenses: p.expenses ?? undefined, currency: p.currency, addressText: p.address ?? undefined, showExactAddress: true },
    money,
  );
  const wa = whatsappUrl(p.agent?.publicWhatsapp, `Hola${p.agent?.displayName ? ` ${p.agent.displayName}` : ""}, vi la propiedad "${p.title}" en el portal y me interesa. ${url}`);
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
      <nav aria-label="Ruta" className="muted text-sm">
        <Link href="/propiedades" className="link">Propiedades</Link> › {p.zoneParentName ? `${p.zoneParentName} › ` : ""}{p.zoneName}
      </nav>

      {closed && (
        <p role="status" className="alert alert-error mt-3 text-base">
          Esta propiedad está <strong>{p.status === "reserved" ? "reservada" : p.operation === "rent" ? "alquilada" : "vendida"}</strong>.
          {p.status === "reserved" ? " Puede volver a estar disponible: consultá con la inmobiliaria." : " Ya no está disponible."}
        </p>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Gallery photos={p.photos} title={p.title} />
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-blue-700 text-white">{OPERATION_LABEL[p.operation]}</span>
              {closed && <StatusBadge status={p.status} operation={p.operation} />}
              <span className="muted text-sm">{TYPE_LABEL[p.type] ?? p.type} · {p.zoneName}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">{p.title}</h1>
            <p className="mt-1 text-3xl font-semibold">{money(p.price)}</p>
            <p lang={p.language} className="mt-4 whitespace-pre-line leading-relaxed">{p.description}</p>
          </section>
          <section className="card">
            <h2 className="mb-3 font-medium">Características</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {facts.map(([k, v]) => <div key={k} className="contents"><dt className="muted">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card space-y-3">
            <h2 className="font-medium">Contacto</h2>
            {p.agent ? (
              <div className="flex items-center gap-3">
                {p.agent.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.agent.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                )}
                <div>
                  <p className="font-medium">{p.agent.displayName ?? "Agente"}</p>
                  <p className="muted text-sm">{p.agencyName}</p>
                </div>
              </div>
            ) : (
              <p className="muted text-sm">{p.agencyName}</p>
            )}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Escribir por WhatsApp</a>}
            {p.agent?.publicPhone && <p className="text-sm">Teléfono: <a className="link" href={`tel:${p.agent.publicPhone.replace(/[^\d+]/g, "")}`}>{p.agent.publicPhone}</a></p>}
            {p.agent?.publicEmail && <p className="text-sm break-all">Email: {p.agent.publicEmail}</p>}
            {!wa && !p.agent?.publicPhone && !p.agent?.publicEmail && <p className="muted text-sm">Los datos de contacto se publicarán pronto.</p>}
          </section>
          <section className="card space-y-1">
            <p className="font-medium">{p.agency.name}</p>
            {p.agency.phone && <p className="muted text-sm">{p.agency.phone}</p>}
            <Link href={`/inmobiliarias/${p.agency.slug}`} className="link text-sm">Ver todas sus propiedades</Link>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function FichaPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <Suspense fallback={<p className="muted">Cargando…</p>}><Ficha params={params} /></Suspense>
    </main>
  );
}
