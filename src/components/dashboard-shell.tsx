import { roleLabel } from "@/lib/role-label";
import { getActor } from "@/server/auth/get-actor";
import { countNewInquiries } from "@/server/services/inquiry";
import { countOpenReports } from "@/server/services/moderation";
import { AppShell, type NavGroup } from "./app-shell";

/** Arma el menú lateral según el rol y lo envuelve alrededor del contenido. */
export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const groups: NavGroup[] = [{ title: "General", items: [{ href: "/panel", label: "Inicio", icon: "home", exact: true }] }];
  if (actor.kind === "user") {
    const mine: NavGroup = { title: "Mi inmobiliaria", items: [{ href: "/panel/agencia", label: "Mi inmobiliaria", icon: "building" }] };
    if (actor.membership) {
      mine.items.push({ href: "/panel/propiedades", label: "Propiedades", icon: "grid" });
      mine.items.push({ href: "/panel/consultas", label: "Consultas", icon: "inbox", badge: await countNewInquiries(actor) });
      if (actor.membership.role === "agency_admin") mine.items.push({ href: "/panel/equipo", label: "Equipo", icon: "users" });
    }
    groups.push(mine);
    if (actor.platformAdmin) {
      groups.push({
        title: "Administración",
        items: [
          { href: "/admin", label: "Resumen", icon: "shield", exact: true },
          { href: "/admin/agencias", label: "Todas las inmobiliarias", icon: "building" },
          { href: "/admin/zonas", label: "Zonas y barrios", icon: "pin" },
          { href: "/admin/denuncias", label: "Denuncias", icon: "flag", badge: await countOpenReports(actor) },
          { href: "/admin/propiedades", label: "Moderar propiedades", icon: "grid" },
          { href: "/admin/registro", label: "Registro de acciones", icon: "list" },
        ],
      });
    }
  }
  return <AppShell groups={groups} role={roleLabel(actor)}>{children}</AppShell>;
}
