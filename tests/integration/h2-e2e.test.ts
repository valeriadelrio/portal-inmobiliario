import { sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor, PropertyInput } from "@/contracts";
import { buildActor } from "@/server/auth/actor";
import { acceptInvitation, getMyAgency, inviteMember, registerAgency, setAgencyStatus, updateMemberProfile } from "@/server/services/agency";
import { confirmPhotoUpload, requestPhotoUpload, setCover } from "@/server/services/photo";
import { changeStatus, createProperty, deleteProperty, listMyProperties, updateProperty } from "@/server/services/property";
import { listActiveZones } from "@/server/services/zone";
import { getStorage } from "@/server/storage";
import type { MemoryStorage } from "@/server/storage/memory";
import { ANON, U, ZONE, admin, as, asUser, id, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

/** Reproduce lo que hace getActor() en la app: perfil + membresía leídos de la base. */
async function actorFor(userId: string): Promise<Actor> {
  const [p] = await admin`select id, platform_role, disabled_at from user_profile where id = ${userId}`;
  const [m] = await admin`select m.id, m.agency_id, m.role, m.status, a.status agency_status
    from agency_member m join agency a on a.id = m.agency_id where m.user_id = ${userId} and m.status = 'active'`;
  return buildActor(
    p ? { id: p.id, platformRole: p.platform_role, disabledAt: p.disabled_at } : null,
    m ? { id: m.id, agencyId: m.agency_id, role: m.role, status: m.status, agencyStatus: m.agency_status } : null,
  );
}
const need = <T>(r: { ok: boolean; data?: T; error?: { code: string; message: string } }): T => {
  if (!r.ok) throw new Error(`${r.error?.code}: ${r.error?.message}`);
  return r.data as T;
};
const jpeg = () => sharp({ create: { width: 1000, height: 700, channels: 3, background: "#456" } }).jpeg().toBuffer();
async function uploadPhoto(actor: Actor, propertyId: string) {
  const req = need(await requestPhotoUpload(actor, propertyId, "image/jpeg", 5000));
  const [row] = await admin`select storage_key from property_photo where id = ${req.photoId}`;
  await ((await getStorage()) as MemoryStorage).putObject(`${row.storage_key}/original`, await jpeg(), "image/jpeg");
  return need(await confirmPhotoUpload(actor, req.photoId));
}
const publicIds = async () => (await as(ANON, (tx) => tx.execute(sql`select id, status from property`))).map((r) => `${r.id}:${r.status}`);

const lot: PropertyInput = {
  type: "lot", operation: "sale", title: "Lote de esquina en Tandil", description: "Hermoso lote de esquina con todos los servicios",
  language: "es", zoneId: ZONE, showExactAddress: false, price: 38000, currency: "USD", totalAreaM2: 420,
  services: ["water", "electricity", "gas"], isCorner: true,
};

describe("H2 de punta a punta: de registrar la inmobiliaria a publicar una propiedad", () => {
  it("recorrido completo con roles, aislamiento y visibilidad pública", async () => {
    const ADMIN_USER = U.visitor;
    const AGENT_USER = id(80);
    await admin`insert into user_profile (id, email) values (${AGENT_USER}, 'nuevo.agente@x.com')`;

    // 1. Una persona registra su inmobiliaria: queda pendiente y todavía no puede cargar propiedades.
    const visitor = await actorFor(ADMIN_USER);
    const { agencyId } = need(await registerAgency(visitor, { name: "Casa Nueva Inmobiliaria", slug: "casa-nueva", displayName: "Laura Gómez" }));
    expect(need(await getMyAgency(visitor))).toMatchObject({ status: "pending", role: "agency_admin" });
    const pendingAdmin = await actorFor(ADMIN_USER);
    expect(pendingAdmin.kind === "user" && pendingAdmin.membership).toBeNull();
    expect((await createProperty(pendingAdmin, lot)).ok).toBe(false);

    // 2. La administración la aprueba; ahora sí tiene membresía efectiva.
    const root = await actorFor(U.root);
    need(await setAgencyStatus(root, agencyId, "approved"));
    const admin1 = await actorFor(ADMIN_USER);
    expect(admin1.kind === "user" && admin1.membership?.role).toBe("agency_admin");

    // 3. Invita a un agente por enlace y el agente acepta con su email.
    const { link } = need(await inviteMember(admin1, { email: "nuevo.agente@x.com", role: "agent" }));
    const agentBefore = await actorFor(AGENT_USER);
    need(await acceptInvitation(agentBefore, link.replace("/invitacion/", ""), "Pedro Agente"));
    const agent = await actorFor(AGENT_USER);
    expect(agent.kind === "user" && agent.membership?.role).toBe("agent");
    need(await updateMemberProfile(agent, { displayName: "Pedro Agente", publicWhatsapp: "5492494111222" }));

    // 4. El agente carga un lote: es borrador y no lo ve el público.
    expect(need(await listActiveZones(agent)).length).toBe(1);
    const { id: propertyId } = need(await createProperty(agent, lot));
    expect(await publicIds()).not.toContain(`${propertyId}:draft`);
    expect(need(await changeStatus(agent, propertyId, "active").then((r) => ({ ok: !r.ok, data: !r.ok && r.error.code })))).toBe("publish_blocked");

    // 5. Sube 3 fotos (la primera es portada) y publica.
    for (let i = 0; i < 3; i++) await uploadPhoto(agent, propertyId);
    need(await changeStatus(agent, propertyId, "active"));
    expect(await publicIds()).toContain(`${propertyId}:active`);

    // 6. Cambia el precio de la ficha y sigue publicada; el slug no cambia.
    const [{ slug: slugBefore }] = await admin`select slug from property where id = ${propertyId}`;
    need(await updateProperty(agent, propertyId, { ...lot, price: 36500 }));
    const [after] = await admin`select slug, price::float price, status from property where id = ${propertyId}`;
    expect(after).toMatchObject({ slug: slugBefore, price: 36500, status: "active" });

    // 7. Otra inmobiliaria y otro agente de la misma no ven ni tocan lo suyo (borrador aparte).
    const draft = need(await createProperty(agent, { ...lot, title: "Otro lote todavía en borrador" }));
    const colleague = await actorFor(id(14)); // b1: agente de la inmobiliaria B
    expect(need(await listMyProperties(colleague)).items.map((i) => i.id)).not.toContain(propertyId);
    expect((await updateProperty(colleague, propertyId, lot)).ok).toBe(false);
    expect((await changeStatus(colleague, propertyId, "paused")).ok).toBe(false);
    expect(await publicIds()).not.toContain(`${draft.id}:draft`);
    expect(need(await listMyProperties(admin1)).total).toBe(2); // su admin ve las dos

    // 8. Si la administración suspende la inmobiliaria, desaparece del público y sus agentes pierden acceso.
    need(await setAgencyStatus(root, agencyId, "suspended", "Prueba"));
    expect(await publicIds()).not.toContain(`${propertyId}:active`);
    const suspended = await actorFor(AGENT_USER);
    expect(suspended.kind === "user" && suspended.membership).toBeNull();
    need(await setAgencyStatus(root, agencyId, "approved"));
    expect(await publicIds()).toContain(`${propertyId}:active`);

    // 9. Pausa, borra el borrador y no puede borrar la publicada.
    expect((await deleteProperty(agent, propertyId)).ok).toBe(false);
    need(await changeStatus(agent, propertyId, "paused"));
    expect(await publicIds()).not.toContain(`${propertyId}:paused`);
    need(await deleteProperty(agent, draft.id));
    need(await setCover(agent, (await admin`select id from property_photo where property_id = ${propertyId} order by position desc limit 1`)[0].id));
    need(await deleteProperty(agent, propertyId));
    expect((await admin`select count(*)::int n from property_photo where property_id = ${propertyId}`)[0].n).toBe(0);
    expect(asUser(U.visitor).kind).toBe("user");
  });
});
