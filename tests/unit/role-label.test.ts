import { describe, expect, it } from "vitest";
import { initials, roleLabel } from "@/lib/role-label";

describe("initials", () => {
  it("usa nombre y apellido, o el email si no hay nombre", () => {
    expect(initials("Valeria del Río", "v@x.com")).toBe("VD");
    expect(initials("Valeria", "v@x.com")).toBe("VA");
    expect(initials(null, "maria.gomez@x.com")).toBe("MG");
    expect(initials("  ", "@x.com")).toBe("?");
  });
});
describe("roleLabel", () => {
  it("nombra cada rol", () => {
    expect(roleLabel({ kind: "anonymous" })).toBe("anónimo");
    expect(roleLabel({ kind: "user", userId: "u", platformAdmin: true, membership: null })).toMatch(/plataforma/);
    expect(roleLabel({ kind: "user", userId: "u", platformAdmin: false, membership: null })).toBe("Visitante");
    expect(roleLabel({ kind: "user", userId: "u", platformAdmin: false, membership: { agencyId: "a", memberId: "m", role: "agent" } })).toBe("Agente");
  });
});
