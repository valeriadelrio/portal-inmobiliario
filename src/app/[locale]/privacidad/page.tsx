import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n";
import { alternates } from "@/lib/seo";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).privacy;
  return { title: t.title, description: t.metaDescription, alternates: alternates("/privacidad", locale) };
}

export default async function PrivacidadPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale).privacy;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="muted mt-1 text-sm">{t.updated}</p>
      </div>
      {t.sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-medium">{s.title}</h2>
          {s.body.map((para) => <p key={para} className="text-slate-700">{para}</p>)}
        </section>
      ))}
      {contact && <p className="text-slate-700">{t.contactLabel} <a className="link" href={`mailto:${contact}`}>{contact}</a></p>}
    </main>
  );
}
