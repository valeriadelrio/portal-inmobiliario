import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";

async function Gate({ require, children }: { require: "user" | "platform_admin"; children: React.ReactNode }) {
  const actor = await getActor();
  if (actor.kind === "anonymous") redirect("/login");
  if (require === "platform_admin" && !actor.platformAdmin) notFound();
  return <>{children}</>;
}

/** Contenido dinámico (depende de la sesión): va dentro de Suspense por cacheComponents. */
export function RoleGate({ require, children }: { require: "user" | "platform_admin"; children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="muted p-6">Cargando…</p>}>
      <Gate require={require}>{children}</Gate>
    </Suspense>
  );
}
