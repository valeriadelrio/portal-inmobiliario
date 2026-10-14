import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { getActor } from "@/server/auth/get-actor";

async function RoleLabel() {
  const actor = await getActor();
  const role =
    actor.kind === "anonymous"
      ? "anónimo"
      : actor.platformAdmin
        ? "administrador de la plataforma"
        : actor.membership
          ? actor.membership.role === "agency_admin" ? "administrador de agencia" : "agente"
          : "visitante";
  return <p className="muted mt-2">Tu rol: <span className="badge">{role}</span></p>;
}

export default function PanelPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <LogoutButton />
      </div>
      <Suspense fallback={<p className="muted mt-2">Cargando…</p>}>
        <RoleLabel />
      </Suspense>
    </main>
  );
}
