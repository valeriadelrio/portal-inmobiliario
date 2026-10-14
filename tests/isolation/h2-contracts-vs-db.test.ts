import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PROPERTY_STATUS, RESERVED_SLUGS, canTransition, type PropertyStatus } from "@/contracts";
import { listActiveZones } from "@/server/services/zone";
import { AG, ANON, P, U, admin, as, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const a1 = asUser(U.a1);

describe("el código y la base dicen lo mismo", () => {
  it("PROPERTY_TRANSITIONS coincide con property_guard en las 25 combinaciones", async () => {
    // P.a1draft con 3 fotos listas y portada: cualquier salto a 'active' cumple las reglas de publicación
    await admin`delete from property_photo where property_id = ${P.a1draft}`;
    for (let i = 0; i < 3; i++)
      await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status)
        values (${P.a1draft}, ${AG.A}, ${"k" + i}, ${i}, ${i === 0}, 'ready')`;

    const mismatches: string[] = [];
    for (const from of PROPERTY_STATUS) {
      for (const to of PROPERTY_STATUS) {
        if (from === to) continue;
        await admin`update property set status = ${from} where id = ${P.a1draft}`;
        let allowed = true;
        try {
          await as(a1, (tx) => tx.execute(sql`update property set status = ${to} where id = ${P.a1draft}`));
        } catch {
          allowed = false;
        }
        if (allowed !== canTransition(from as PropertyStatus, to as PropertyStatus)) mismatches.push(`${from}→${to}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("RESERVED_SLUGS coincide con la lista de app_register_agency", async () => {
    for (const slug of RESERVED_SLUGS) {
      const err = await as(asUser(U.visitor), (tx) =>
        tx.execute(sql`select app_register_agency('Nombre Ok', ${slug}, '1', 'a@a.com', 'Ana')`),
      ).catch((e) => e);
      expect(String(err?.cause?.message ?? err?.message), slug).toBe("invalid_slug");
    }
  });
});

describe("listActiveZones (servicio real sobre la base de pruebas)", () => {
  it("devuelve solo las activas, para cualquier rol", async () => {
    await admin`insert into zone (slug, name_es, is_active, sort_order) values ('cerrada', 'Cerrada', false, 5), ('norte', 'Norte', true, 1)`;
    for (const actor of [ANON, asUser(U.visitor), a1]) {
      const r = await listActiveZones(actor);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.map((z) => z.slug)).toEqual(["centro", "norte"]); // por sort_order (0 y 1)
    }
  });
});
