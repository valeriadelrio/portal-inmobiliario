import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { addFavorite, isFavorite, listFavorites, removeFavorite } from "@/server/services/favorite";
import { countNewInquiries, createInquiry, listInquiries, setInquiryStatus } from "@/server/services/inquiry";
import { AG, ANON, INQ, M, P, U, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const member = (userId: string, agencyId: string, memberId: string, role: "agent" | "agency_admin" = "agent"): Actor =>
  ({ kind: "user", userId, platformAdmin: false, membership: { agencyId, memberId, role } });
const a1 = member(U.a1, AG.A, M.a1);
const a2 = member(U.a2, AG.A, M.a2);
const admA = member(U.admA, AG.A, M.admA, "agency_admin");
const b1 = member(U.b1, AG.B, M.b1);

const form = (o: Record<string, unknown> = {}) => ({
  propertyId: P.a1, name: "Carla", email: "Carla@Mail.com", message: "Hola, quiero visitarla", locale: "es" as const, consent: true as const, ...o,
});
const inq = (o: Record<string, unknown> = {}) => createInquiry(ANON, form(o) as never, { ipHash: "h1" });

describe("crear consulta", () => {
  it("un visitante anónimo consulta una ficha activa y llega al agente dueño", async () => {
    const r = await inq();
    expect(r.ok).toBe(true);
    const mine = await listInquiries(a1);
    expect(mine.ok && mine.data.items.map((i) => i.name)).toContain("Carla");
    const other = await listInquiries(a2);
    expect(other.ok && other.data.items.map((i) => i.name)).not.toContain("Carla");
    const [row] = await admin`select email, consent_at, user_id from inquiry where name = 'Carla'`;
    expect(row.email).toBe("carla@mail.com"); // normalizado
    expect(row.consent_at).toBeTruthy();
    expect(row.user_id).toBeNull();
  });
  it("con sesión queda asociada a la cuenta", async () => {
    const r = await createInquiry(asUser(U.visitor), form() as never);
    expect(r.ok).toBe(true);
    const [row] = await admin`select user_id from inquiry where name = 'Carla'`;
    expect(row.user_id).toBe(U.visitor);
  });
  it("sin consentimiento no se guarda", async () => {
    const r = await inq({ consent: false });
    expect(!r.ok && r.error.code).toBe("consent_required");
    expect((await admin`select 1 from inquiry where name = 'Carla'`).length).toBe(0);
  });
  it("valida los datos", async () => {
    for (const bad of [{ name: "A" }, { email: "no-es-email" }, { message: "corto" }, { propertyId: "xx" }]) {
      const r = await inq(bad);
      expect(!r.ok && r.error.code).toBe("validation");
    }
  });
  it("no se puede consultar un borrador, una pausada ni una propiedad de inmobiliaria no aprobada", async () => {
    for (const p of [P.a1draft, P.a1paused, P.pending, P.susp]) {
      const r = await inq({ propertyId: p });
      expect(!r.ok && r.error.code).toBe("not_found");
    }
  });
  it("limita a 5 consultas por hora desde la misma IP", async () => {
    for (let i = 0; i < 5; i++) expect((await inq()).ok).toBe(true);
    const r = await inq();
    expect(!r.ok && r.error.code).toBe("rate_limited");
    expect((await createInquiry(ANON, form() as never, { ipHash: "otra" })).ok).toBe(true);
  });
});

describe("bandeja", () => {
  it("cada agente ve las suyas, el administrador las de su inmobiliaria, y nadie las de otra", async () => {
    const names = async (a: Actor) => { const r = await listInquiries(a); if (!r.ok) throw new Error(r.error.code); return r.data.items.map((i) => i.id).sort(); };
    expect(await names(a1)).toEqual([INQ.a1]);
    expect(await names(a2)).toEqual([INQ.a2]);
    expect(await names(admA)).toEqual([INQ.a1, INQ.a2].sort());
    expect(await names(b1)).toEqual([INQ.b1]);
  });
  it("un visitante sin inmobiliaria no tiene bandeja", async () => {
    const r = await listInquiries(asUser(U.visitor));
    expect(!r.ok && r.error.code).toBe("forbidden");
    const anon = await listInquiries(ANON);
    expect(!anon.ok && anon.error.code).toBe("unauthenticated");
  });
  it("filtra por estado y cuenta las nuevas", async () => {
    expect(await countNewInquiries(admA)).toBe(2);
    expect((await setInquiryStatus(a1, INQ.a1, "read")).ok).toBe(true);
    expect(await countNewInquiries(admA)).toBe(1);
    const read = await listInquiries(admA, { status: "read" });
    expect(read.ok && read.data.items.map((i) => i.id)).toEqual([INQ.a1]);
    expect(read.ok && read.data.unread).toBe(1);
  });
  it("solo el destinatario o el administrador cambian el estado", async () => {
    const other = await setInquiryStatus(a2, INQ.a1, "answered");
    expect(!other.ok && ["forbidden", "not_found"].includes(other.error.code)).toBe(true);
    const cross = await setInquiryStatus(b1, INQ.a1, "answered");
    expect(!cross.ok).toBe(true);
    expect((await setInquiryStatus(admA, INQ.a1, "answered")).ok).toBe(true);
    const [row] = await admin`select status from inquiry where id = ${INQ.a1}`;
    expect(row.status).toBe("answered");
    const bad = await setInquiryStatus(a1, INQ.a1, "otro" as never);
    expect(!bad.ok && bad.error.code).toBe("validation");
  });
});

describe("favoritos", () => {
  it("agregar, listar y quitar", async () => {
    const v = asUser(U.visitor);
    expect(await isFavorite(v, P.a2)).toBe(false);
    expect((await addFavorite(v, P.a2)).ok).toBe(true);
    expect((await addFavorite(v, P.a2)).ok).toBe(true); // idempotente
    expect(await isFavorite(v, P.a2)).toBe(true);
    const list = await listFavorites(v);
    expect(list.ok && list.data.map((c) => c.id).sort()).toEqual([P.a1, P.a2].sort());
    expect((await removeFavorite(v, P.a2)).ok).toBe(true);
    expect(await isFavorite(v, P.a2)).toBe(false);
  });
  it("cada usuario ve solo los suyos", async () => {
    const r = await listFavorites(asUser(U.a1));
    expect(r.ok && r.data.map((c) => c.id)).toEqual([P.b1]);
  });
  it("sin sesión no hay favoritos", async () => {
    const r = await addFavorite(ANON, P.a1);
    expect(!r.ok && r.error.code).toBe("unauthenticated");
  });
  it("no se pueden marcar borradores ni propiedades ocultas", async () => {
    const r = await addFavorite(asUser(U.visitor), P.a1draft);
    expect(!r.ok && r.error.code).toBe("not_found");
  });
  it("una propiedad que deja de ser pública sale de la lista", async () => {
    await admin`update property set status = 'paused' where id = ${P.a1}`;
    const r = await listFavorites(asUser(U.visitor));
    expect(r.ok && r.data).toEqual([]);
  });
});
