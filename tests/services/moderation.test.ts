import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { createInquiry } from "@/server/services/inquiry";
import { listMyProperties } from "@/server/services/property";
import {
  countOpenReports, listAuditLog, listPropertiesForModeration, listReports, moderateProperty, reportProperty, resolveReport,
} from "@/server/services/moderation";
import { getPublicProperty, listPublicCardsBySlugs, searchProperties } from "@/server/services/public";
import { AG, ANON, M, P, U, admin, as, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const member = (userId: string, agencyId: string, memberId: string, role: "agent" | "agency_admin" = "agent"): Actor =>
  ({ kind: "user", userId, platformAdmin: false, membership: { agencyId, memberId, role } });
const a1 = member(U.a1, AG.A, M.a1);
const admA = member(U.admA, AG.A, M.admA, "agency_admin");
const root: Actor = { kind: "user", userId: U.root, platformAdmin: true, membership: null };
const visitor = asUser(U.visitor);

const rep = (o: Record<string, unknown> = {}) => ({ propertyId: P.a1, reason: "fake" as const, message: "Parece falsa", ...o });

describe("denunciar", () => {
  it("un visitante anónimo denuncia una ficha pública", async () => {
    const r = await reportProperty(ANON, rep(), { ipHash: "h1" });
    expect(r.ok && r.data.duplicate).toBe(false);
    const [row] = await admin`select reason, status, user_id, ip_hash from property_report`;
    expect(row).toMatchObject({ reason: "fake", status: "open", user_id: null, ip_hash: "h1" });
  });
  it("con sesión queda asociada a la cuenta; el email se normaliza", async () => {
    await reportProperty(visitor, rep({ email: "Ana@Mail.com" }), { ipHash: "h2" });
    const [row] = await admin`select user_id, reporter_email from property_report`;
    expect(row).toMatchObject({ user_id: U.visitor, reporter_email: "ana@mail.com" });
  });
  it("repetir la misma denuncia abierta no falla ni duplica", async () => {
    await reportProperty(ANON, rep(), { ipHash: "h1" });
    const again = await reportProperty(ANON, rep({ reason: "other" }), { ipHash: "h1" });
    expect(again.ok && again.data.duplicate).toBe(true);
    expect(await admin`select 1 from property_report`).toHaveLength(1);
  });
  it("no se puede denunciar una ficha que el público no ve (borrador) ni una inexistente", async () => {
    const draft = await reportProperty(ANON, rep({ propertyId: P.a1draft }), { ipHash: "h1" });
    expect(!draft.ok && draft.error.code).toBe("not_found");
    const none = await reportProperty(ANON, rep({ propertyId: "00000000-0000-4000-8000-0000000000ff" }), { ipHash: "h1" });
    expect(!none.ok && none.error.code).toBe("not_found");
  });
  it("valida el motivo y el largo del mensaje", async () => {
    const bad = await reportProperty(ANON, rep({ reason: "spam" }) as never, { ipHash: "h1" });
    expect(!bad.ok && bad.error.code).toBe("validation");
    const long = await reportProperty(ANON, rep({ message: "x".repeat(1001) }), { ipHash: "h1" });
    expect(!long.ok && long.error.code).toBe("validation");
  });
  it("la base limita a 5 denuncias por hora por huella de IP", async () => {
    // 5 denuncias cerradas de la misma huella en la última hora (cerradas: no chocan con el índice de "una abierta por ficha")
    for (const t of [P.a1, P.a2, P.b1, P.pending, P.susp]) {
      await admin`insert into property_report (property_id, reason, ip_hash, status) values (${t}, 'other', 'spam', 'dismissed')`;
    }
    const r = await reportProperty(ANON, rep({ propertyId: P.b1 }), { ipHash: "spam" });
    expect(!r.ok && r.error.code).toBe("rate_limited");
    expect((await reportProperty(ANON, rep({ propertyId: P.b1 }), { ipHash: "otra" })).ok).toBe(true);
  });
  it("el denunciante no puede leer denuncias ni resolverlas", async () => {
    await reportProperty(visitor, rep(), { ipHash: "h1" });
    for (const a of [ANON, visitor, a1, admA]) {
      const l = await listReports(a);
      expect(!l.ok && l.error.code).toBe("forbidden");
    }
    const rows = await as(visitor, (tx) => tx.execute(sql`select * from property_report`));
    expect([...rows]).toHaveLength(0);
  });
});

describe("bandeja de denuncias (plataforma)", () => {
  it("lista, cuenta abiertas y descarta", async () => {
    await reportProperty(ANON, rep(), { ipHash: "h1" });
    await reportProperty(visitor, rep({ reason: "sold" }), { ipHash: "h2" });
    const l = await listReports(root, { status: "open" });
    expect(l.ok && l.data.items).toHaveLength(2);
    expect(l.ok && l.data.items[0].openForProperty).toBe(2);
    expect(await countOpenReports(root)).toBe(2);
    expect(await countOpenReports(a1)).toBe(0);

    const first = l.ok ? l.data.items[0] : null;
    expect((await resolveReport(root, first!.id, "dismiss", "No es cierto")).ok).toBe(true);
    expect(await countOpenReports(root)).toBe(1);
    const again = await resolveReport(root, first!.id, "dismiss");
    expect(!again.ok && again.error.code).toBe("invalid_transition");
    const log = await listAuditLog(root);
    expect(log.ok && log.data.items.map((e) => e.action)).toContain("report.dismiss");
  });
  it("ocultar desde la denuncia cierra todas las denuncias abiertas de esa ficha y la saca del público", async () => {
    await reportProperty(ANON, rep(), { ipHash: "h1" });
    await reportProperty(visitor, rep(), { ipHash: "h2" });
    const l = await listReports(root, { status: "open" });
    const id = l.ok ? l.data.items[0].id : "";
    expect((await resolveReport(root, id, "hide", "Es una estafa")).ok).toBe(true);
    expect(await countOpenReports(root)).toBe(0);
    const [p] = await admin`select moderation_status, moderation_reason, moderated_by from property where id = ${P.a1}`;
    expect(p).toMatchObject({ moderation_status: "hidden", moderation_reason: "Es una estafa", moderated_by: U.root });
    const [{ n }] = await admin`select count(*)::int as n from property_report where status = 'actioned'`;
    expect(n).toBe(2);
  });
});

describe("ocultar y restituir", () => {
  it("solo la plataforma; exige motivo", async () => {
    for (const a of [ANON, visitor, a1, admA]) {
      const r = await moderateProperty(a, P.a1, true, "motivo");
      expect(!r.ok && r.error.code).toBe("forbidden");
    }
    const noReason = await moderateProperty(root, P.a1, true, " ");
    expect(!noReason.ok && noReason.error.code).toBe("validation");
    expect((await moderateProperty(root, P.a1, true, "Datos de contacto falsos")).ok).toBe(true);
    const twice = await moderateProperty(root, P.a1, true, "otra vez");
    expect(!twice.ok && twice.error.code).toBe("invalid_transition");
    const missing = await moderateProperty(root, "00000000-0000-4000-8000-0000000000ff", true, "motivo");
    expect(!missing.ok && missing.error.code).toBe("not_found");
  });
  it("una ficha oculta desaparece del sitio público, de las consultas y de las tarjetas de favoritos, pero no de su inmobiliaria", async () => {
    await moderateProperty(root, P.a1, true, "Contenido inapropiado");
    const s = await searchProperties({} as never);
    expect(s.ok && JSON.stringify(s.data)).not.toContain("slug-" + P.a1);
    const cards = await listPublicCardsBySlugs(["slug-" + P.a1, "slug-" + P.a2]);
    expect(cards.ok && cards.data.map((c) => c.slug)).toEqual(["slug-" + P.a2]);
    const detail = await getPublicProperty("slug-" + P.a1);
    expect(detail.ok && detail.data).toBeFalsy();
    const inq = await createInquiry(ANON, { propertyId: P.a1, name: "Carla", email: "c@x.com", message: "Hola, quiero visitarla", locale: "es", consent: true }, { ipHash: "h1" });
    expect(!inq.ok && inq.error.code).toBe("not_found");
    const rpt = await reportProperty(ANON, rep(), { ipHash: "h9" });
    expect(!rpt.ok && rpt.error.code).toBe("not_found");

    const mine = await listMyProperties(a1);
    const row = mine.ok ? mine.data.items.find((i) => i.id === P.a1) : null;
    expect(row).toMatchObject({ moderationStatus: "hidden", moderationReason: "Contenido inapropiado" });
  });
  it("la inmobiliaria no puede cambiar la moderación ni borrar una ficha oculta", async () => {
    await moderateProperty(root, P.a1paused, true, "Contenido inapropiado");
    await as(a1, (tx) => tx.execute(sql`update property set moderation_status = 'ok', moderation_reason = null where id = ${P.a1paused}`));
    const [p] = await admin`select moderation_status, moderation_reason from property where id = ${P.a1paused}`;
    expect(p).toMatchObject({ moderation_status: "hidden", moderation_reason: "Contenido inapropiado" });
    const del = await as(a1, (tx) => tx.execute(sql`delete from property where id = ${P.a1paused} returning id`));
    expect([...del]).toHaveLength(0);
    // ni siquiera el platform admin puede saltarse la función con un UPDATE directo
    await as(root, (tx) => tx.execute(sql`update property set moderation_status = 'ok' where id = ${P.a1paused}`));
    const [q] = await admin`select moderation_status from property where id = ${P.a1paused}`;
    expect(q.moderation_status).toBe("hidden");
  });
  it("una ficha nueva no puede nacer oculta ni con motivo", async () => {
    await as(a1, (tx) => tx.execute(sql`insert into property (id, agency_id, agent_id, operation, type, title, description, zone_id,
      price, total_area_m2, slug, moderation_status, moderation_reason) select '00000000-0000-4000-8000-0000000000aa', ${AG.A}, ${M.a1}, 'sale', 'lot', 'x', 'y', zone_id, 10, 10, 'nueva-ficha', 'hidden', 'x' from property where id = ${P.a1}`));
    const [p] = await admin`select moderation_status, moderation_reason from property where slug = 'nueva-ficha'`;
    expect(p).toMatchObject({ moderation_status: "ok", moderation_reason: null });
  });
  it("restituir la devuelve al público y limpia el motivo; todo queda auditado", async () => {
    await moderateProperty(root, P.a1, true, "Contenido inapropiado");
    expect((await moderateProperty(root, P.a1, false)).ok).toBe(true);
    const detail = await getPublicProperty("slug-" + P.a1);
    expect(detail.ok && detail.data).toBeTruthy();
    const [p] = await admin`select moderation_status, moderation_reason from property where id = ${P.a1}`;
    expect(p).toMatchObject({ moderation_status: "ok", moderation_reason: null });
    const log = await listAuditLog(root, { prefix: "property." });
    expect(log.ok && log.data.items.map((e) => [e.action, e.detail, e.actorEmail])).toEqual([
      ["property.unhide", null, "root@x.com"], ["property.hide", "Contenido inapropiado", "root@x.com"],
    ]);
  });
  it("el listado de moderación busca por título, dirección web o inmobiliaria", async () => {
    await moderateProperty(root, P.a1, true, "Contenido inapropiado");
    const all = await listPropertiesForModeration(root, {});
    expect(all.ok && all.data.total).toBeGreaterThan(5);
    const hidden = await listPropertiesForModeration(root, { hidden: true });
    expect(hidden.ok && hidden.data.items.map((i) => i.id)).toEqual([P.a1]);
    const byAgency = await listPropertiesForModeration(root, { q: "Agencia B" });
    expect(byAgency.ok && byAgency.data.items.every((i) => i.agencyName === "Agencia B")).toBe(true);
    const denied = await listPropertiesForModeration(a1, {});
    expect(!denied.ok && denied.error.code).toBe("forbidden");
  });
});

describe("registro de acciones", () => {
  it("solo la plataforma lo lee y la base no lo expone a otros roles", async () => {
    await moderateProperty(root, P.a1, true, "Contenido inapropiado");
    for (const a of [ANON, visitor, a1, admA]) {
      const r = await listAuditLog(a);
      expect(!r.ok && r.error.code).toBe("forbidden");
    }
    // saltando el servicio, la función de la base también lo rechaza
    await expect(as(admA, (tx) => tx.execute(sql`select * from app_list_audit(10, 0, null)`))).rejects.toThrow();
    await expect(as(admA, (tx) => tx.execute(sql`select * from audit_log`))).rejects.toThrow();
    const ok = await listAuditLog(root);
    expect(ok.ok && ok.data.items[0]).toMatchObject({ action: "property.hide", agencyName: "Agencia A" });
  });
});
