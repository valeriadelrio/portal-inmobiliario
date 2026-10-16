import type { Actor } from "@/contracts";
import { runAsActor, type Tx } from "@/server/db/run-as-actor";
import { testClients } from "./db";

export const { admin, db } = testClients();

// ---- ids fijos ----------------------------------------------------------------------
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const AG = { A: id(1), B: id(2), PENDING: id(3), SUSPENDED: id(4) };
export const U = { a1: id(11), a2: id(12), admA: id(13), b1: id(14), admB: id(15), visitor: id(16), root: id(17), pend: id(18), susp: id(19) };
export const M = { a1: id(21), a2: id(22), admA: id(23), b1: id(24), admB: id(25), pend: id(26), susp: id(27) };
export const ZONE = id(30);
export const P = {
  a1: id(41), a1draft: id(42), a2: id(43), a2draft: id(44), b1: id(45), bdraft: id(46),
  pending: id(47), susp: id(48), a1paused: id(49),
};
export const INQ = { a1: id(61), a2: id(62), b1: id(63) };

export const asUser = (userId: string): Actor => ({ kind: "user", userId, platformAdmin: false, membership: null });
export const ANON: Actor = { kind: "anonymous" };
export const as = <T>(actor: Actor, fn: (tx: Tx) => Promise<T>) => runAsActor(db, actor, fn);
export const ids = (rows: Iterable<Record<string, unknown>>) => [...rows].map((r) => r.id as string).sort();
export const sorted = (...x: string[]) => [...x].sort();

export async function seed() {
  await admin.unsafe(`truncate audit_log, property_report, agency_invitation, inquiry, property_photo, property_lot, property_building,
    property, agency_member, zone, user_profile, agency restart identity cascade`);

  const agencies = [
    [AG.A, "Agencia A", "a", "approved"], [AG.B, "Agencia B", "b", "approved"],
    [AG.PENDING, "Pendiente", "pend", "pending"], [AG.SUSPENDED, "Suspendida", "susp", "suspended"],
  ];
  for (const [i, n, s, st] of agencies)
    await admin`insert into agency (id, name, slug, status) values (${i}, ${n}, ${s}, ${st})`;

  const users: [string, string, string | null][] = [
    [U.a1, "a1@x.com", null], [U.a2, "a2@x.com", null], [U.admA, "admA@x.com", null], [U.b1, "b1@x.com", null],
    [U.admB, "admB@x.com", null], [U.visitor, "visitor@x.com", null], [U.root, "root@x.com", "platform_admin"],
    [U.pend, "pend@x.com", null], [U.susp, "susp@x.com", null],
  ];
  for (const [i, e, r] of users) await admin`insert into user_profile (id, email, platform_role) values (${i}, ${e}, ${r})`;

  const members: [string, string, string, string][] = [
    [M.a1, AG.A, U.a1, "agent"], [M.a2, AG.A, U.a2, "agent"], [M.admA, AG.A, U.admA, "agency_admin"],
    [M.b1, AG.B, U.b1, "agent"], [M.admB, AG.B, U.admB, "agency_admin"],
    [M.pend, AG.PENDING, U.pend, "agent"], [M.susp, AG.SUSPENDED, U.susp, "agent"],
  ];
  for (const [i, a, u, r] of members)
    await admin`insert into agency_member (id, agency_id, user_id, role, status) values (${i}, ${a}, ${u}, ${r}, 'active')`;

  await admin`insert into zone (id, slug, name_es) values (${ZONE}, 'centro', 'Centro')`;

  const props: [string, string, string, string][] = [
    [P.a1, AG.A, M.a1, "active"], [P.a1draft, AG.A, M.a1, "draft"], [P.a1paused, AG.A, M.a1, "paused"],
    [P.a2, AG.A, M.a2, "active"], [P.a2draft, AG.A, M.a2, "draft"],
    [P.b1, AG.B, M.b1, "active"], [P.bdraft, AG.B, M.b1, "draft"],
    [P.pending, AG.PENDING, M.pend, "active"], [P.susp, AG.SUSPENDED, M.susp, "active"],
  ];
  for (const [i, a, m, st] of props)
    await admin`insert into property (id, agency_id, agent_id, operation, type, status, title, description, zone_id,
      price, currency, total_area_m2, slug)
      values (${i}, ${a}, ${m}, 'sale', 'lot', ${st}, 'Lote', 'Descripción de prueba', ${ZONE}, 1000, 'USD', 300, ${"slug-" + i})`;

  await admin`insert into property_lot (property_id) values (${P.a1}), (${P.a1draft})`;
  await admin`insert into property_photo (property_id, agency_id, storage_key) values
    (${P.a1}, ${AG.A}, 'k1'), (${P.a1draft}, ${AG.A}, 'k2')`;

  for (const [i, p, a, m] of [[INQ.a1, P.a1, AG.A, M.a1], [INQ.a2, P.a2, AG.A, M.a2], [INQ.b1, P.b1, AG.B, M.b1]])
    await admin`insert into inquiry (id, property_id, agency_id, agent_id, name, email, message, consent_at)
      values (${i}, ${p}, ${a}, ${m}, 'Ana', 'ana@x.com', 'Hola me interesa', now())`;

}

