import Link from "next/link";
import { Suspense } from "react";
import type { Actor } from "@/contracts";
import { getActor } from "@/server/auth/get-actor";

function roleLabel(actor: Actor): string {
  if (actor.kind === "anonymous") return "anónimo";
  if (actor.platformAdmin) return "administrador de la plataforma";
  if (actor.membership) return actor.membership.role === "agency_admin" ? "administrador de agencia" : "agente";
  return "visitante";
}

type Shortcut = { href: string; title: string; text: string };

function shortcuts(actor: Actor): Shortcut[] {
  const list: Shortcut[] = [];
  if (actor.kind === "user" && actor.platformAdmin) {
    list.push({ href: "/admin", title: "Administración", text: "Secciones de la plataforma." });
    list.push({ href: "/admin/zonas", title: "Zonas y barrios", text: "Alta, edición e importación por CSV." });
  }
  return list;
}

async function Dashboard() {
  const actor = await getActor();
  const items = shortcuts(actor);
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
      {items.length === 0 && (
        <p className="card muted mt-6 text-sm">
          Todavía no tenés accesos acá. Cuando registres una agencia o te inviten a una, vas a verla en este panel.
        </p>
      )}
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
