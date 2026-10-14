import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";

/** Menú principal según el rol. Es solo navegación: la autorización real está en layouts, servicios y RLS. */
export async function SiteNav() {
  const actor = await getActor();
  if (actor.kind === "anonymous") {
    return <Link href="/login" className="btn btn-primary">Ingresar</Link>;
  }
  return (
    <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
      <NavLink href="/panel">Panel</NavLink>
      {actor.platformAdmin && <NavLink href="/admin/zonas">Zonas</NavLink>}
      <span className="mx-2 hidden h-5 w-px bg-slate-300 sm:block" />
      <LogoutButton />
    </nav>
  );
}
