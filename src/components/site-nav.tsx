import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import type { Locale } from "@/i18n";
import { initials, roleLabel } from "@/lib/role-label";
import { NavView } from "./nav-view";

/** Menú principal según el rol. Es solo navegación: la autorización real está en layouts, servicios y RLS. */
export async function SiteNav({ locale }: { locale: Locale }) {
  const actor = await getActor();
  if (actor.kind === "anonymous") return <NavView data={null} locale={locale} />;
  const profile = await getProfileSummary(actor.userId);
  const email = profile?.email ?? "";
  const name = profile?.fullName?.trim() || email.split("@")[0] || "Mi cuenta";
  return <NavView data={{ initials: initials(profile?.fullName ?? null, email || "?"), name, email, role: roleLabel(actor) }} locale={locale} />;
}
