import type { Actor } from "@/contracts";

/** Recursos mínimos que necesita una política para decidir. */
export type PropertyRef = { agencyId: string; agentId: string; status: string };
export type InquiryRef = { agencyId: string; agentId: string };
export type MemberRef = { agencyId: string };

export type Action =
  | { type: "property:create"; agencyId: string }
  | { type: "property:update" | "property:delete" | "property:publish"; property: PropertyRef }
  | { type: "property:read"; property: PropertyRef }
  | { type: "inquiry:read" | "inquiry:update"; inquiry: InquiryRef }
  | { type: "member:manage"; member: MemberRef }
  | { type: "agency:approve" | "zone:manage" | "moderate" };

/** Estados visibles para el público (reservada y vendida/alquilada se muestran con cartel). */
export const PUBLIC_STATUSES = ["active", "reserved", "sold_rented"] as const;

/**
 * Única fuente de verdad de permisos. Todo servicio debe pasar por aquí.
 * Nota: agencyId siempre se compara contra el Actor, nunca contra datos del cliente.
 */
export function can(actor: Actor, action: Action): boolean {
  if (actor.kind === "anonymous") {
    return action.type === "property:read" && PUBLIC_STATUSES.includes(action.property.status as never);
  }
  if (actor.platformAdmin) return true;

  const m = actor.membership;

  switch (action.type) {
    case "property:read":
      if (PUBLIC_STATUSES.includes(action.property.status as never)) return true;
      return !!m && m.agencyId === action.property.agencyId &&
        (m.role === "agency_admin" || m.memberId === action.property.agentId);
    case "property:create":
      return !!m && m.agencyId === action.agencyId;
    case "property:update":
    case "property:delete":
    case "property:publish":
      return !!m && m.agencyId === action.property.agencyId &&
        (m.role === "agency_admin" || m.memberId === action.property.agentId);
    case "inquiry:read":
    case "inquiry:update":
      return !!m && m.agencyId === action.inquiry.agencyId &&
        (m.role === "agency_admin" || m.memberId === action.inquiry.agentId);
    case "member:manage":
      return !!m && m.role === "agency_admin" && m.agencyId === action.member.agencyId;
    case "agency:approve":
    case "zone:manage":
    case "moderate":
      return false; // solo platform admin
  }
}
