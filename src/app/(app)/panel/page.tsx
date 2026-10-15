import { Suspense } from "react";
import type { Actor } from "@/contracts";
import { roleLabel } from "@/lib/role-label";
import { getActor } from "@/server/auth/get-actor";
import { getMyAgency } from "@/server/services/agency";
import { IconCard } from "@/components/icon-card";
import type { IconName } from "@/components/icons";
import { DashboardSkeleton } from "@/components/skeletons";

type Shortcut = { href: string; icon: IconName; title: string; text: string };

async function shortcuts(actor: Actor): Promise<Shortcut[]> {
  if (actor.kind !== "user") return [];
  const list: Shortcut[] = [];
  const mine = await getMyAgency(actor);
  if (mine.ok && mine.data) {
    const st = mine.data.status;
    list.push({
      href: "/panel/agencia", icon: "building", title: `Mi inmobiliaria: ${mine.data.name}`,
      text: st === "approved" ? "Datos de la inmobiliaria y tu perfil público." : st === "pending" ? "Pendiente de aprobación." : `Estado: ${st}.`,
    });
    if (actor.membership) list.push({ href: "/panel/propiedades", icon: "grid", title: "Propiedades", text: "Cargá, editá y publicá tus propiedades y lotes." });
    if (actor.membership) list.push({ href: "/panel/consultas", icon: "inbox", title: "Consultas", text: "Mensajes de quienes se interesaron en tus propiedades." });
    if (actor.membership?.role === "agency_admin") list.push({ href: "/panel/equipo", icon: "users", title: "Equipo", text: "Integrantes e invitaciones." });
  } else {
    list.push({ href: "/registro-agencia", icon: "building", title: "Registrar mi inmobiliaria", text: "Enviá la solicitud para publicar propiedades." });
  }
  if (actor.platformAdmin) {
    list.push({ href: "/admin/agencias", icon: "shield", title: "Todas las inmobiliarias", text: "Aprobar, rechazar o suspender inmobiliarias." });
    list.push({ href: "/admin/zonas", icon: "pin", title: "Zonas y barrios", text: "Alta, edición e importación por CSV." });
  }
  return list;
}

async function Dashboard() {
  const actor = await getActor();
  const items = await shortcuts(actor);
  return (
    <>
      <p className="muted mt-2">Tu rol: <span className="badge">{roleLabel(actor)}</span></p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <IconCard key={i.href} {...i} />
        ))}
      </div>
    </>
  );
}

export default function PanelPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
