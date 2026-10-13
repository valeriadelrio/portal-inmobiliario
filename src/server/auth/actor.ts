import { ANONYMOUS, type Actor, type MemberRole } from "@/contracts";

export type ProfileRow = { id: string; platformRole: string | null; disabledAt: Date | null };
export type MembershipRow = {
  id: string;
  agencyId: string;
  role: string;
  status: string;
  agencyStatus: string;
};

/**
 * Construye el Actor desde filas ya leídas de la base. Función pura (testeable).
 * La membresía solo cuenta si está activa Y la agencia está aprobada.
 */
export function buildActor(profile: ProfileRow | null, membership: MembershipRow | null): Actor {
  if (!profile || profile.disabledAt) return ANONYMOUS;
  const active = membership && membership.status === "active" && membership.agencyStatus === "approved";
  return {
    kind: "user",
    userId: profile.id,
    platformAdmin: profile.platformRole === "platform_admin",
    membership: active
      ? { agencyId: membership.agencyId, memberId: membership.id, role: membership.role as MemberRole }
      : null,
  };
}
