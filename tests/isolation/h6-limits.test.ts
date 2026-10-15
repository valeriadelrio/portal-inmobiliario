import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/run-as-actor";
import { AG, M, P, U, ZONE, admin, as, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? "unknown";
  }
}

describe("topes de uso por inmobiliaria (los hace cumplir la base)", () => {
  it("invitaciones: 30 por día por inmobiliaria", async () => {
    await admin.unsafe(`insert into agency_invitation (agency_id, email, token_hash, status, invited_by, expires_at)
      select '${AG.A}', 'x' || g || '@x.com', 'h' || g, 'revoked', '${U.admA}', now() + interval '7 days' from generate_series(1, 30) g`);
    const invite = (email: string) => (tx: Tx) => tx.execute(sql`insert into agency_invitation (agency_id, email, token_hash, invited_by, expires_at)
      values (${AG.A}, ${email}, ${"t-" + email}, ${U.admA}, now() + interval '7 days')`);
    expect(await failure(as(asUser(U.admA), invite("nuevo@x.com")))).toBe("rate_limited");
    // otra inmobiliaria no se ve afectada
    await expect(as(asUser(U.admB), (tx) => tx.execute(sql`insert into agency_invitation (agency_id, email, token_hash, invited_by, expires_at)
      values (${AG.B}, 'ok@x.com', 'tok-b', ${U.admB}, now() + interval '7 days')`))).resolves.toBeDefined();
  });

  it("fotos: 200 por hora por inmobiliaria", async () => {
    // 7 fichas auxiliares con 29 fotos recientes cada una (el máximo por ficha es 30) = 203 en la última hora
    await admin.unsafe(`insert into property (id, agency_id, agent_id, operation, type, title, description, zone_id, price, total_area_m2, slug)
      select ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, '${AG.A}', '${M.a1}', 'sale', 'lot', 't', 'd', '${ZONE}', 10, 10, 'aux-' || g
      from generate_series(1, 7) g`);
    await admin.unsafe(`insert into property_photo (property_id, agency_id, storage_key, position, status)
      select p.id, '${AG.A}', 'aux-' || p.slug || '-' || g, g, 'pending' from property p, generate_series(1, 29) g where p.slug like 'aux-%'`);
    const add = (tx: Tx) => tx.execute(sql`insert into property_photo (property_id, agency_id, storage_key, position, status)
      values (${P.a1draft}, ${AG.A}, 'una-mas', 50, 'pending')`);
    expect(await failure(as(asUser(U.a1), add))).toBe("rate_limited");
    // las fotos viejas no cuentan
    await admin.unsafe(`update property_photo set created_at = now() - interval '2 hours' where storage_key like 'aux-%'`);
    await expect(as(asUser(U.a1), add)).resolves.toBeDefined();
  });

  it("propiedades: 100 por día por inmobiliaria", async () => {
    await admin.unsafe(`insert into property (agency_id, agent_id, operation, type, title, description, zone_id, price, total_area_m2, slug)
      select '${AG.A}', '${M.a1}', 'sale', 'lot', 't', 'd', '${ZONE}', 10, 10, 'bulk-' || g from generate_series(1, 100) g`);
    const create = (tx: Tx) => tx.execute(sql`insert into property (agency_id, agent_id, operation, type, title, description, zone_id,
      price, total_area_m2, slug) values (${AG.A}, ${M.a1}, 'sale', 'lot', 'Lote', 'Descripción', ${ZONE}, 10, 10, 'una-mas')`);
    expect(await failure(as(asUser(U.a1), create))).toBe("rate_limited");
  });
});
