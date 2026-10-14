import { describe, expect, it } from "vitest";
import { can } from "@/server/auth/policies";
import { actors, AGENCY_A, AGENCY_B, propA1 } from "../fixtures/actors";

describe("aislamiento entre agencias", () => {
  const writes = ["property:update", "property:delete", "property:publish"] as const;

  for (const type of writes) {
    it(`${type}: el agente dueño sí, otro agente de la misma agencia no, otra agencia no`, () => {
      const a = { type, property: propA1() };
      expect(can(actors.agentA1, a)).toBe(true);
      expect(can(actors.agentA2, a)).toBe(false);
      expect(can(actors.adminA, a)).toBe(true);
      expect(can(actors.agentB1, a)).toBe(false);
      expect(can(actors.adminB, a)).toBe(false);
      expect(can(actors.visitor, a)).toBe(false);
      expect(can(actors.anonymous, a)).toBe(false);
      expect(can(actors.platformAdmin, a)).toBe(true);
    });
  }

  it("create: solo miembros de esa agencia", () => {
    expect(can(actors.agentA1, { type: "property:create", agencyId: AGENCY_A })).toBe(true);
    expect(can(actors.agentA1, { type: "property:create", agencyId: AGENCY_B })).toBe(false);
    expect(can(actors.visitor, { type: "property:create", agencyId: AGENCY_A })).toBe(false);
  });

  it("consultas: solo el agente destinatario o el admin de su agencia", () => {
    const a = { type: "inquiry:read" as const, inquiry: { agencyId: AGENCY_A, agentId: "m-a1" } };
    expect(can(actors.agentA1, a)).toBe(true);
    expect(can(actors.agentA2, a)).toBe(false);
    expect(can(actors.adminA, a)).toBe(true);
    expect(can(actors.adminB, a)).toBe(false);
    expect(can(actors.anonymous, a)).toBe(false);
  });

  it("gestión de miembros: solo admin de esa agencia", () => {
    const a = { type: "member:manage" as const, member: { agencyId: AGENCY_A } };
    expect(can(actors.adminA, a)).toBe(true);
    expect(can(actors.agentA1, a)).toBe(false);
    expect(can(actors.adminB, a)).toBe(false);
  });

  it("acciones de plataforma: solo platform admin", () => {
    for (const type of ["agency:approve", "zone:manage", "moderate"] as const) {
      expect(can(actors.platformAdmin, { type })).toBe(true);
      expect(can(actors.adminA, { type })).toBe(false);
      expect(can(actors.anonymous, { type })).toBe(false);
    }
  });
});

describe("lectura pública", () => {
  it("activa, reservada y vendida/alquilada son públicas; borrador y pausada no", () => {
    for (const status of ["active", "reserved", "sold_rented"])
      expect(can(actors.anonymous, { type: "property:read", property: propA1(status) })).toBe(true);
    for (const status of ["draft", "paused"]) {
      const a = { type: "property:read" as const, property: propA1(status) };
      expect(can(actors.anonymous, a)).toBe(false);
      expect(can(actors.agentB1, a)).toBe(false);
      expect(can(actors.agentA1, a)).toBe(true);
      expect(can(actors.agentA2, a)).toBe(false);
      expect(can(actors.adminA, a)).toBe(true);
    }
  });
});

describe("políticas nuevas de H2", () => {
  it("agency:update e invitation:manage: solo el admin de esa agencia", () => {
    for (const type of ["agency:update", "invitation:manage"] as const) {
      expect(can(actors.adminA, { type, agencyId: AGENCY_A })).toBe(true);
      expect(can(actors.adminA, { type, agencyId: AGENCY_B })).toBe(false);
      expect(can(actors.agentA1, { type, agencyId: AGENCY_A })).toBe(false);
      expect(can(actors.visitor, { type, agencyId: AGENCY_A })).toBe(false);
      expect(can(actors.anonymous, { type, agencyId: AGENCY_A })).toBe(false);
      expect(can(actors.platformAdmin, { type, agencyId: AGENCY_A })).toBe(true);
    }
  });
  it("member:update-self: solo el propio usuario dentro de su agencia", () => {
    const a = { type: "member:update-self" as const, member: { agencyId: AGENCY_A, userId: "u-a1" } };
    expect(can(actors.agentA1, a)).toBe(true);
    expect(can(actors.agentA2, a)).toBe(false);
    expect(can(actors.agentB1, a)).toBe(false);
  });
  it("photo:manage sigue la misma regla que editar la propiedad", () => {
    const a = { type: "photo:manage" as const, property: propA1() };
    expect(can(actors.agentA1, a)).toBe(true);
    expect(can(actors.agentA2, a)).toBe(false);
    expect(can(actors.adminA, a)).toBe(true);
    expect(can(actors.adminB, a)).toBe(false);
  });
  it("zone:read-inactive: solo platform admin", () => {
    expect(can(actors.platformAdmin, { type: "zone:read-inactive" })).toBe(true);
    expect(can(actors.adminA, { type: "zone:read-inactive" })).toBe(false);
  });
});
