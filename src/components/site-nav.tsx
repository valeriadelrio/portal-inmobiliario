import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { initials, roleLabel } from "@/lib/role-label";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

/** Menú principal según el rol. Es solo navegación: la autorización real está en layouts, servicios y RLS. */
export async function SiteNav() {
  const actor = await getActor();
  if (actor.kind === "anonymous") {
    return <Link href="/login" className="btn btn-primary">Ingresar</Link>;
  }
  const profile = await getProfileSummary(actor.userId);
  const email = profile?.email ?? "";
  const name = profile?.fullName?.trim() || email.split("@")[0] || "Mi cuenta";
  return (
    <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
      <NavLink href="/panel" exact>Panel</NavLink>
      <NavLink href="/panel/agencia">Mi inmobiliaria</NavLink>
      {actor.membership && <NavLink href="/panel/equipo">Equipo</NavLink>}
      {actor.platformAdmin && <NavLink href="/admin/agencias">Todas las inmobiliarias</NavLink>}
      {actor.platformAdmin && <NavLink href="/admin/zonas">Zonas</NavLink>}
      <span className="mx-2 hidden h-6 w-px bg-slate-300 sm:block" />
      <UserMenu initials={initials(profile?.fullName ?? null, email || "?")} name={name} email={email} role={roleLabel(actor)} />
    </nav>
  );
}
