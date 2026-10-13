import { describe, expect, it } from "vitest";
import { buildActor } from "@/server/auth/actor";

const profile = { id: "u1", platformRole: null, disabledAt: null };
const member = { id: "m1", agencyId: "a1", role: "agent", status: "active", agencyStatus: "approved" };

describe("buildActor", () => {
  it("sin perfil o deshabilitado es anónimo", () => {
    expect(buildActor(null, null).kind).toBe("anonymous");
    expect(buildActor({ ...profile, disabledAt: new Date() }, member).kind).toBe("anonymous");
  });
  it("sin membresía es visitante", () => {
    expect(buildActor(profile, null)).toMatchObject({ kind: "user", membership: null });
  });
  it("membresía activa de agencia aprobada da agencia y rol", () => {
    expect(buildActor(profile, member)).toMatchObject({ membership: { agencyId: "a1", role: "agent" } });
  });
  it("agencia suspendida/pendiente o miembro invitado NO da permisos de agencia", () => {
    for (const bad of [{ agencyStatus: "suspended" }, { agencyStatus: "pending" }, { status: "invited" }])
      expect(buildActor(profile, { ...member, ...bad })).toMatchObject({ membership: null });
  });
  it("detecta platform admin", () => {
    expect(buildActor({ ...profile, platformRole: "platform_admin" }, null)).toMatchObject({ platformAdmin: true });
  });
});
