import type { MemberRole } from "./enums";

/** Quién hace la petición. Se construye UNA vez en el middleware; nunca viene del cliente. */
export type Actor =
  | { kind: "anonymous" }
  | {
      kind: "user";
      userId: string;
      platformAdmin: boolean;
      /** Solo si es miembro activo de una agencia aprobada. */
      membership: { agencyId: string; memberId: string; role: MemberRole } | null;
    };

export const ANONYMOUS: Actor = { kind: "anonymous" };
