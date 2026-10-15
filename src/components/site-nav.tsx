import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { getDict, localePath, type Locale } from "@/i18n";
import { initials, roleLabel } from "@/lib/role-label";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

/** Menú principal según el rol. Es solo navegación: la autorización real está en layouts, servicios y RLS. */
export async function SiteNav({ locale }: { locale: Locale }) {
  const t = getDict(locale).site;
  const actor = await getActor();
  if (actor.kind === "anonymous") {
    return <Link href="/login" className="btn btn-primary">{t.login}</Link>;
  }
  const profile = await getProfileSummary(actor.userId);
  const email = profile?.email ?? "";
  const name = profile?.fullName?.trim() || email.split("@")[0] || "Mi cuenta";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NavLink href={localePath(locale, "/cuenta/favoritos")}>{t.favorites}</NavLink>
      <NavLink href="/panel">{t.myPanel}</NavLink>
      <UserMenu initials={initials(profile?.fullName ?? null, email || "?")} name={name} email={email} role={roleLabel(actor)} />
    </div>
  );
}
