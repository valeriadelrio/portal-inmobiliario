import type { Actor } from "@/contracts";

export const AGENCY_A = "00000000-0000-0000-0000-00000000000a";
export const AGENCY_B = "00000000-0000-0000-0000-00000000000b";

const user = (userId: string, membership: any = null, platformAdmin = false): Actor =>
  ({ kind: "user", userId, platformAdmin, membership });

export const actors = {
  anonymous: { kind: "anonymous" } as Actor,
  visitor: user("u-visitor"),
  agentA1: user("u-a1", { agencyId: AGENCY_A, memberId: "m-a1", role: "agent" }),
  agentA2: user("u-a2", { agencyId: AGENCY_A, memberId: "m-a2", role: "agent" }),
  adminA: user("u-admA", { agencyId: AGENCY_A, memberId: "m-admA", role: "agency_admin" }),
  agentB1: user("u-b1", { agencyId: AGENCY_B, memberId: "m-b1", role: "agent" }),
  adminB: user("u-admB", { agencyId: AGENCY_B, memberId: "m-admB", role: "agency_admin" }),
  platformAdmin: user("u-root", null, true),
};

/** Propiedad de la agencia A, del agente A1. */
export const propA1 = (status = "active") => ({ agencyId: AGENCY_A, agentId: "m-a1", status });
