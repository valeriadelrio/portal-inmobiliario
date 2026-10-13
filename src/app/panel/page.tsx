import { Suspense } from "react";
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
  return <p className="mt-2 text-zinc-600">Tu rol: {role}</p>;
}

export default function PanelPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <Suspense fallback={<p className="mt-2 text-zinc-400">Cargando…</p>}>
        <RoleLabel />
      </Suspense>
    </main>
  );
}
