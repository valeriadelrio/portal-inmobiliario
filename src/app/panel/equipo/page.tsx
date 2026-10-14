import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { listInvitations, listMembers } from "@/server/services/agency";
import { InviteForm, RemoveMember, ResendButton, RevokeButton, RoleSelect } from "./forms";
import { ListSkeleton } from "@/components/skeletons";

const ROLE = { agent: "Agente", agency_admin: "Administrador" } as Record<string, string>;
const INV_STATUS = { pending: "Pendiente", accepted: "Aceptada", revoked: "Revocada" } as Record<string, string>;

async function Equipo() {
  const actor = await getActor();
  const members = await listMembers(actor);
  if (!members.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="alert alert-error">El equipo está disponible para integrantes de una inmobiliaria aprobada.</p>
      </main>
    );
  }
  const isAdmin = actor.kind === "user" && actor.membership?.role === "agency_admin";
  const invitations = isAdmin ? await listInvitations(actor) : null;
  const me = actor.kind === "user" ? actor.membership?.memberId : undefined;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Equipo</h1>

      {isAdmin && (
        <section className="card space-y-3">
          <h2 className="font-medium">Invitar a una persona</h2>
          <p className="muted text-sm">Se genera un enlace personal: se lo enviás vos (WhatsApp, email). Solo funciona con el email indicado.</p>
          <InviteForm />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Integrantes ({members.data.length})</h2>
        {members.data.map((m) => (
          <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{m.displayName ?? "Sin nombre"} {m.id === me && <span className="badge">vos</span>}</p>
              <p className="muted text-sm">{ROLE[m.role] ?? m.role}{m.publicWhatsapp ? ` · WhatsApp ${m.publicWhatsapp}` : " · sin WhatsApp cargado"}</p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <RoleSelect memberId={m.id} role={m.role} />
                <RemoveMember memberId={m.id} others={members.data.filter((o) => o.id !== m.id).map((o) => ({ id: o.id, name: o.displayName ?? "Sin nombre" }))} />
              </div>
            )}
          </div>
        ))}
      </section>

      {isAdmin && invitations?.ok && (
        <section className="space-y-3">
          <h2 className="font-medium">Invitaciones</h2>
          {invitations.data.length === 0 && <p className="muted text-sm">No hay invitaciones.</p>}
          {invitations.data.map((i) => {
            const expired = i.status === "pending" && new Date(i.expiresAt) < new Date();
            return (
              <div key={i.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{i.email}</p>
                  <p className="muted text-sm">
                    {ROLE[i.role] ?? i.role} · {expired ? "Vencida" : INV_STATUS[i.status] ?? i.status}
                    {i.status === "pending" && !expired && ` · vence ${new Date(i.expiresAt).toLocaleDateString("es-AR")}`}
                  </p>
                </div>
                {i.status !== "accepted" && (
                  <div className="flex flex-wrap items-start gap-2">
                    <ResendButton id={i.id} />
                    {i.status === "pending" && !expired && <RevokeButton id={i.id} />}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default function EquipoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-6 py-8"><ListSkeleton /></div>}>
      <Equipo />
    </Suspense>
  );
}
