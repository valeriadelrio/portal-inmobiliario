import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ZoneCsvRow } from "@/contracts";
import { zoneCsvRow } from "@/contracts";
import { createZone, deleteZone, importZonesFromCsv, listActiveZones, listAllZones, updateZone } from "@/server/services/zone";
import { ANON, U, ZONE, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const root = { ...asUser(U.root), platformAdmin: true };
const a1 = asUser(U.a1);
const input = (slug: string, extra = {}) => ({ slug, nameEs: slug.toUpperCase(), sortOrder: 0, isActive: true, ...extra });
const row = (r: Partial<Record<string, string>>): ZoneCsvRow => zoneCsvRow.parse(r);

describe("servicio de zonas", () => {
  it("solo la administración gestiona zonas", async () => {
    for (const actor of [ANON, asUser(U.visitor), a1]) {
      for (const r of [
        await listAllZones(actor), await createZone(actor, input("xx")), await updateZone(actor, ZONE, input("xx")),
        await deleteZone(actor, ZONE), await importZonesFromCsv(actor, [row({ slug: "xx", name_es: "Xx" })]),
      ])
        expect(r.ok === false && r.error.code).toBe("forbidden");
    }
    expect((await admin`select count(*)::int n from zone`)[0].n).toBe(1);
  });

  it("alta, edición y baja", async () => {
    const c = await createZone(root, input("villa-italia"));
    if (!c.ok) throw new Error(c.error.message);
    const u = await updateZone(root, c.data.id, input("villa-italia", { nameEs: "Villa Italia", nameEn: "Italia" }));
    expect(u.ok && u.data.nameEs).toBe("Villa Italia");
    expect((await deleteZone(root, c.data.id)).ok).toBe(true);
    const gone = await updateZone(root, c.data.id, input("villa-italia"));
    expect(!gone.ok && gone.error.code).toBe("not_found");
    const again = await deleteZone(root, c.data.id);
    expect(!again.ok && again.error.code).toBe("not_found");
  });

  it("rechaza slug repetido, slug inválido y más de 2 niveles", async () => {
    const dup = await createZone(root, input("centro"));
    expect(!dup.ok && dup.error.code).toBe("conflict");
    const bad = await createZone(root, input("Slug Malo"));
    expect(!bad.ok && bad.error.code).toBe("validation");
    const child = await createZone(root, input("micro", { parentId: ZONE }));
    expect(child.ok).toBe(true);
    const deep = await createZone(root, input("nieta", { parentId: child.ok ? child.data.id : "" }));
    expect(!deep.ok && deep.error.code).toBe("zone_depth");
  });

  it("no borra una zona en uso (propiedades): in_use", async () => {
    await admin`insert into agency_member (id, agency_id, user_id, role, status) values (gen_random_uuid(), (select id from agency limit 1), ${U.visitor}, 'agent', 'active') on conflict do nothing`;
    await admin`insert into property (agency_id, agent_id, operation, type, title, description, zone_id, price, total_area_m2, slug)
      select agency_id, id, 'sale', 'lot', 'T', 'Descripción', ${ZONE}, 1, 1, 'en-uso' from agency_member where user_id = ${U.visitor}`;
    const r = await deleteZone(root, ZONE);
    expect(!r.ok && r.error.code).toBe("in_use");
  });

  it("listActiveZones oculta las inactivas; listAllZones las muestra", async () => {
    await createZone(root, input("cerrada", { isActive: false }));
    const pub = await listActiveZones(ANON);
    expect(pub.ok && pub.data.map((z) => z.slug)).toEqual(["centro"]);
    const all = await listAllZones(root);
    expect(all.ok && all.data.map((z) => z.slug).sort()).toEqual(["centro", "cerrada"]);
  });
});

describe("importación CSV", () => {
  it("crea y actualiza por slug, con padres antes que hijas", async () => {
    const rows = [
      row({ slug: "hija", name_es: "Hija", parent_slug: "madre" }),
      row({ slug: "madre", name_es: "Madre" }),
      row({ slug: "centro", name_es: "Centro nuevo" }),
    ];
    const r = await importZonesFromCsv(root, rows);
    expect(r).toEqual({ ok: true, data: { created: 2, updated: 1 } });
    const db = await admin`select z.slug, z.name_es, p.slug parent from zone z left join zone p on p.id = z.parent_id order by z.slug`;
    expect(db.map((x) => [x.slug, x.name_es, x.parent])).toEqual([
      ["centro", "Centro nuevo", null], ["hija", "Hija", "madre"], ["madre", "Madre", null],
    ]);
  });
  it("es idempotente", async () => {
    const rows = [row({ slug: "norte", name_es: "Norte" })];
    await importZonesFromCsv(root, rows);
    const again = await importZonesFromCsv(root, rows);
    expect(again).toEqual({ ok: true, data: { created: 0, updated: 1 } });
  });
  it("todo o nada: un error no deja filas a medias", async () => {
    const r = await importZonesFromCsv(root, [
      row({ slug: "buena", name_es: "Buena" }),
      row({ slug: "mala", name_es: "Mala", parent_slug: "no-existe" }),
    ]);
    expect(!r.ok && r.error.code).toBe("validation");
    expect((await admin`select count(*)::int n from zone`)[0].n).toBe(1);
  });
  it("rechaza slugs repetidos y 3 niveles, sin escribir nada", async () => {
    const dup = await importZonesFromCsv(root, [row({ slug: "aa1", name_es: "Aa" }), row({ slug: "aa1", name_es: "Bb" })]);
    expect(!dup.ok && dup.error.code).toBe("validation");
    const deep = await importZonesFromCsv(root, [
      row({ slug: "mm", name_es: "Mm" }), row({ slug: "hh", name_es: "Hh", parent_slug: "mm" }),
      row({ slug: "nn", name_es: "Nn", parent_slug: "hh" }),
    ]);
    expect(!deep.ok && deep.error.code).toBe("zone_depth");
    expect((await admin`select count(*)::int n from zone`)[0].n).toBe(1);
  });
  it("el CSV de ejemplo del repo es válido", async () => {
    const { readFileSync } = await import("node:fs");
    const { parse } = await import("csv-parse/sync");
    const rows = (parse(readFileSync("db/seeds/zones.csv"), { columns: true, skip_empty_lines: true }) as unknown[]).map((r) => zoneCsvRow.parse(r));
    expect(rows.length).toBeGreaterThan(3);
    expect((await importZonesFromCsv(root, rows)).ok).toBe(true);
  });
});
