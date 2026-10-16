import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { getDict, type Locale } from "@/i18n";
import { isOwnAgencyProperty } from "@/server/services/inquiry";
import { InquiryForm } from "./inquiry-form";

/** Parte de la ficha que depende de la sesión (datos precargados si hay cuenta). Va dentro de <Suspense>: la ficha en sí es cacheable. */
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
