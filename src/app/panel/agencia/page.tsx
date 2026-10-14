import Link from "next/link";
import { getActor } from "@/server/auth/get-actor";
import { getMyAgency, getMyAgencyDetail } from "@/server/services/agency";
import { AgencyForm, ProfileForm } from "./forms";

const STATUS: Record<string, { label: string; text: string; tone: string }> = {
  pending: { label: "Pendiente de aprobación", tone: "alert-error", text: "La administración del portal está revisando tu solicitud. Todavía no podés publicar." },
  approved: { label: "Aprobada", tone: "alert-ok", text: "Tu agencia está activa." },
  rejected: { label: "Rechazada", tone: "alert-error", text: "Tu solicitud fue rechazada." },
  suspended: { label: "Suspendida", tone: "alert-error", text: "Tu agencia está suspendida: sus propiedades no se muestran." },
};

export default async function MiAgenciaPage() {
  const actor = await getActor();
  const mine = await getMyAgency(actor);
  if (!mine.ok) return <p className="alert alert-error m-6">No se pudo cargar tu agencia.</p>;
  if (!mine.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Mi agencia</h1>
        <div className="card">
          <p>Todavía no pertenecés a ninguna inmobiliaria.</p>
          <p className="muted mt-1 text-sm">Podés registrar la tuya o abrir el enlace de invitación que te envíe tu administrador.</p>
          <Link href="/registro-agencia" className="btn btn-primary mt-4">Registrar mi inmobiliaria</Link>
        </div>
      </main>
    );
  }
  const a = mine.data;
  const st = STATUS[a.status] ?? STATUS.pending;
  const isAdmin = a.role === "agency_admin";

  const detail = await getMyAgencyDetail(actor);
  if (!detail.ok || !detail.data) return <p className="alert alert-error m-6">No se pudo cargar tu agencia.</p>;
  const { agency: ag, member: me } = detail.data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{a.name}</h1>
        <p className="muted text-sm">/{a.slug}</p>
      </div>
      <div className={`alert ${st.tone}`}>
        <strong>{st.label}.</strong> {st.text} {a.statusReason && <>Motivo: {a.statusReason}</>}
      </div>

      {a.status === "approved" && isAdmin && (
        <section className="card space-y-3">
          <h2 className="font-medium">Datos de la agencia</h2>
          <AgencyForm v={{
            name: ag.name, description: ag.description ?? "", phone: ag.phone ?? "", email: ag.email ?? "",
            website: ag.website ?? "", address: ag.address ?? "", logoUrl: ag.logoUrl ?? "",
          }} />
        </section>
      )}

      {a.status === "approved" && me && (
        <section className="card space-y-3">
          <h2 className="font-medium">Mi perfil público</h2>
          <p className="muted text-sm">Esto es lo que ven los interesados junto a tus propiedades.</p>
          <ProfileForm v={{
            displayName: me.displayName ?? "", bio: me.bio ?? "", photoUrl: me.photoUrl ?? "", publicPhone: me.publicPhone ?? "",
            publicWhatsapp: me.publicWhatsapp ?? "", publicEmail: me.publicEmail ?? "",
          }} />
        </section>
      )}
    </main>
  );
}
