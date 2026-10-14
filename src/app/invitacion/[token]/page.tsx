import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { previewInvitation } from "@/server/services/agency";
import { AcceptForm } from "./accept-form";
import { FormSkeleton } from "@/components/skeletons";

const ROLE = { agent: "agente", agency_admin: "administrador" } as Record<string, string>;

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await getActor();
  const pv = await previewInvitation(token);
  if (!pv.ok) {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Invitación no válida</h1>
        <p className="muted text-sm">El enlace venció, fue revocado o ya se usó. Pedile a tu administrador una invitación nueva.</p>
      </div>
    );
  }
  return (
    <div className="card space-y-4">
      <h1 className="text-xl font-semibold">Te invitaron a {pv.data.agencyName}</h1>
      <p className="muted text-sm">Como {ROLE[pv.data.role] ?? pv.data.role}. La invitación es para <strong>{pv.data.email}</strong>: tenés que ingresar con ese email.</p>
      {actor.kind === "anonymous" ? (
        <div className="flex flex-wrap gap-3">
          <Link href={`/login?next=/invitacion/${token}`} className="btn btn-primary">Ingresar o crear cuenta</Link>
        </div>
      ) : (
        <AcceptForm token={token} />
      )}
    </div>
  );
}

export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Suspense fallback={<FormSkeleton fields={1} heading={false} />}><Invitation params={params} /></Suspense>
    </main>
  );
}
