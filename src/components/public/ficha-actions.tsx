import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { isFavorite } from "@/server/services/favorite";
import { FavoriteButton } from "./favorite-button";
import { InquiryForm } from "./inquiry-form";

/** Partes de la ficha que dependen de la sesión (favorito y datos precargados). Va dentro de <Suspense>: la ficha en sí es cacheable. */
export async function FavoriteSlot({ propertyId, slug }: { propertyId: string; slug: string }) {
  const actor = await getActor();
  if (actor.kind === "anonymous") {
    return <Link href={`/login?next=${encodeURIComponent(`/propiedades/${slug}`)}`} className="btn w-full">Ingresá para guardar en favoritos</Link>;
  }
  return <FavoriteButton propertyId={propertyId} initial={await isFavorite(actor, propertyId)} />;
}

export async function InquirySlot({ propertyId, title, open }: { propertyId: string; title: string; open: boolean }) {
  if (!open) return <p className="muted text-sm">Esta propiedad ya no recibe consultas.</p>;
  const actor = await getActor();
  const profile = actor.kind === "user" ? await getProfileSummary(actor.userId) : null;
  return <InquiryForm propertyId={propertyId} title={title} defaults={profile ? { name: profile.fullName?.trim() ?? "", email: profile.email ?? "" } : undefined} />;
}
