import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { getDict, localePath, type Locale } from "@/i18n";
import { isFavorite } from "@/server/services/favorite";
import { isOwnAgencyProperty } from "@/server/services/inquiry";
import { FavoriteButton } from "./favorite-button";
import { InquiryForm } from "./inquiry-form";

/** Partes de la ficha que dependen de la sesión (favorito y datos precargados). Va dentro de <Suspense>: la ficha en sí es cacheable. */
export async function FavoriteSlot({ propertyId, slug, locale }: { propertyId: string; slug: string; locale: Locale }) {
  const t = getDict(locale).ficha;
  const actor = await getActor();
  if (actor.kind === "anonymous") {
    return <Link href={`/login?next=${encodeURIComponent(localePath(locale, `/propiedades/${slug}`))}`} className="btn w-full">{t.favLogin}</Link>;
  }
  return <FavoriteButton propertyId={propertyId} locale={locale} initial={await isFavorite(actor, propertyId)} />;
}

export async function InquirySlot({ propertyId, title, open, locale }: { propertyId: string; title: string; open: boolean; locale: Locale }) {
  const t = getDict(locale).ficha;
  if (!open) return <p className="muted text-sm">{t.noInquiries}</p>;
  const actor = await getActor();
  if (await isOwnAgencyProperty(actor, propertyId)) {
    return (
      <p className="muted text-sm">
        {t.ownProperty} <Link href="/panel/consultas" className="link">{t.ownPropertyLink}</Link>.
      </p>
    );
  }
  const profile = actor.kind === "user" ? await getProfileSummary(actor.userId) : null;
  return <InquiryForm propertyId={propertyId} title={title} locale={locale} defaults={profile ? { name: profile.fullName?.trim() ?? "", email: profile.email ?? "" } : undefined} />;
}
