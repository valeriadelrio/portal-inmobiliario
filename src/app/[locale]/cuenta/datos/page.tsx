import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoleGate } from "@/components/role-gate";
import { DashboardSkeleton } from "@/components/skeletons";
import { getDict, isLocale, localePath, type Locale } from "@/i18n";
import { getActor } from "@/server/auth/get-actor";
import { DeleteForm } from "./delete-form";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).account.title : undefined, robots: { index: false } };
}

async function Datos({ locale }: { locale: Locale }) {
  const t = getDict(locale).account;
  const actor = await getActor();
  const blocked = actor.kind === "user" && (!!actor.membership || actor.platformAdmin);
  return (
    <>
      <section className="card space-y-3">
        <p className="text-slate-700">{t.intro}</p>
        {/* descarga directa: la ruta responde con Content-Disposition: attachment */}
        <a href="/api/account/export" className="btn" download>{t.download}</a>
        <p className="text-sm"><Link href={localePath(locale, "/privacidad")} className="link">{t.privacy}</Link></p>
      </section>
      <section className="card space-y-3">
        <h2 className="font-medium">{t.deleteTitle}</h2>
        {blocked ? <p className="alert alert-error">{t.memberBlocked}</p> : (
          <>
            <p className="muted text-sm">{t.deleteText}</p>
            <DeleteForm locale={locale} />
          </>
        )}
      </section>
    </>
  );
}

export default async function DatosPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{getDict(locale).account.title}</h1>
      <RoleGate require="user">
        <Suspense fallback={<DashboardSkeleton />}><Datos locale={locale} /></Suspense>
      </RoleGate>
    </main>
  );
}
