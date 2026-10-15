import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { anonymizeOldInquiries, purgeAbandonedUploads, runMaintenance, scrubShortLivedData } from "@/server/maintenance";
import { getStorage } from "@/server/storage";
import { AG, INQ, P, admin, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const OLD = "now() - interval '3 days'";

describe("subidas abandonadas", () => {
  it("borra las pendientes viejas (fila y objetos) y deja las recientes y las listas", async () => {
    const storage = await getStorage();
    await storage.putObject("properties/x/old/original", Buffer.from("a"), "image/jpeg");
    await admin.unsafe(`insert into property_photo (id, property_id, agency_id, storage_key, position, status, created_at) values
      ('00000000-0000-4000-8000-0000000000b1', '${P.a1}', '${AG.A}', 'properties/x/old', 5, 'pending', ${OLD}),
      ('00000000-0000-4000-8000-0000000000b2', '${P.a1}', '${AG.A}', 'properties/x/fresh', 6, 'pending', now()),
      ('00000000-0000-4000-8000-0000000000b3', '${P.a1}', '${AG.A}', 'properties/x/ready', 7, 'ready', ${OLD})`);
    expect(await purgeAbandonedUploads()).toBe(1);
    const keys = (await admin`select storage_key from property_photo where property_id = ${P.a1} order by storage_key`).map((r) => r.storage_key);
    expect(keys).toEqual(expect.arrayContaining(["properties/x/fresh", "properties/x/ready"]));
    expect(keys).not.toContain("properties/x/old");
    expect(await storage.getObject("properties/x/old/original")).toBeNull();
    expect(await purgeAbandonedUploads()).toBe(0); // idempotente
  });
});

describe("datos de corta vida", () => {
  it("borra la huella de IP a los 30 días y el email del denunciante al año de resuelta", async () => {
    await admin.unsafe(`update inquiry set ip_hash = 'h', created_at = now() - interval '40 days' where id = '${INQ.a1}'`);
    await admin.unsafe(`update inquiry set ip_hash = 'h' where id = '${INQ.a2}'`);
    await admin.unsafe(`insert into property_report (property_id, reason, ip_hash, reporter_email, status, resolved_at, created_at) values
      ('${P.a1}', 'fake', 'h', 'a@x.com', 'dismissed', now() - interval '400 days', now() - interval '401 days'),
      ('${P.a2}', 'fake', 'h', 'b@x.com', 'open', null, now() - interval '40 days')`);
    expect(await scrubShortLivedData()).toBe(3);
    const inqs = await admin`select id, ip_hash from inquiry where id in (${INQ.a1}, ${INQ.a2})`;
    expect(Object.fromEntries(inqs.map((r) => [r.id, r.ip_hash]))).toEqual({ [INQ.a1]: null, [INQ.a2]: "h" });
    const reps = await admin`select status, ip_hash, reporter_email from property_report order by status`;
    expect(reps.map((r) => [r.status, r.ip_hash, r.reporter_email])).toEqual([["dismissed", null, null], ["open", "h", "b@x.com"]]);
  });
});

describe("consultas antiguas", () => {
  it("anonimiza los datos personales pasado el plazo y conserva la fila", async () => {
    await admin.unsafe(`update inquiry set created_at = now() - interval '25 months' where id = '${INQ.a1}'`);
    expect(await anonymizeOldInquiries(24)).toBe(1);
    const [old] = await admin`select name, email, phone, message, status, property_id from inquiry where id = ${INQ.a1}`;
    expect(old).toMatchObject({ name: "(eliminado)", email: "eliminado@invalid", phone: null, property_id: P.a1 });
    const [recent] = await admin`select name, email from inquiry where id = ${INQ.a2}`;
    expect(recent).toMatchObject({ name: "Ana", email: "ana@x.com" });
    expect(await anonymizeOldInquiries(24)).toBe(0);
  });
  it("runMaintenance deja constancia en el registro solo si cambió algo", async () => {
    expect(await runMaintenance()).toEqual({ abandonedUploads: 0, scrubbed: 0, anonymizedInquiries: 0 });
    expect(await admin`select 1 from audit_log where action = 'maintenance.run'`).toHaveLength(0);
    await admin.unsafe(`update inquiry set created_at = now() - interval '30 months' where id = '${INQ.b1}'`);
    expect((await runMaintenance()).anonymizedInquiries).toBe(1);
    const [row] = await admin`select detail from audit_log where action = 'maintenance.run'`;
    expect(JSON.parse(row.detail)).toMatchObject({ anonymizedInquiries: 1 });
  });
});
