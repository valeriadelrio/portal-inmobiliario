import Link from "next/link";
import { Suspense } from "react";
import type { Actor } from "@/contracts";
import { roleLabel } from "@/lib/role-label";
import { getActor } from "@/server/auth/get-actor";
import { getMyAgency } from "@/server/services/agency";

type Shortcut = { href: string; title: string; text: string };

async function shortcuts(actor: Actor): Promise<Shortcut[]> {
  if (actor.kind !== "user") return [];
  const list: Shortcut[] = [];
  const mine = await getMyAgency(actor);
  if (mine.ok && mine.data) {
    const st = mine.data.status;
    list.push({
      href: "/panel/agencia", title: `Mi inmobiliaria: ${mine.data.name}`,
      text: st === "approved" ? "Datos de la inmobiliaria y tu perfil público." : st === "pending" ? "Pendiente de aprobación." : `Estado: ${st}.`,
    });
    if (actor.membership) list.push({ href: "/panel/propiedades", title: "Propiedades", text: "Cargá, editá y publicá tus propiedades y lotes." });
    if (actor.membership) list.push({ href: "/panel/equipo", title: "Equipo", text: "Integrantes e invitaciones." });
  } else {
    list.push({ href: "/registro-agencia", title: "Registrar mi inmobiliaria", text: "Enviá la solicitud para publicar propiedades." });
  }
  if (actor.platformAdmin) {
    list.push({ href: "/admin/agencias", title: "Todas las inmobiliarias", text: "Aprobar, rechazar o suspender inmobiliarias." });
    list.push({ href: "/admin/zonas", title: "Zonas y barrios", text: "Alta, edición e importación por CSV." });
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
          <Link key={i.href} href={i.href} className="card block hover:border-blue-700">
            <p className="font-medium">{i.title}</p>
            <p className="muted mt-1 text-sm">{i.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function PanelPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <Suspense fallback={<p className="muted mt-2">Cargando…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
