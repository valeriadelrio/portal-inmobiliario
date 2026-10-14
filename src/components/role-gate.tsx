import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { DashboardSkeleton } from "@/components/skeletons";

async function Gate({ require, children }: { require: "user" | "platform_admin"; children: React.ReactNode }) {
  const actor = await getActor();
  if (actor.kind === "anonymous") redirect("/login");
  if (require === "platform_admin" && !actor.platformAdmin) notFound();
  return <>{children}</>;
}

/** Contenido dinámico (depende de la sesión): va dentro de Suspense por cacheComponents. */
export function RoleGate({ require, children }: { require: "user" | "platform_admin"; children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-6 py-8"><DashboardSkeleton /></div>}>
      <Gate require={require}>{children}</Gate>
    </Suspense>
  );
}
