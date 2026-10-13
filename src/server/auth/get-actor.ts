import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { connection } from "next/server";
import type { Actor } from "@/contracts";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { agency, agencyMember, userProfile } from "@/server/db/schema";
import { buildActor } from "./actor";

/** Actor de la petición actual. Siempre se deriva de la sesión, nunca de datos del cliente. */
export const getActor = cache(async (): Promise<Actor> => {
  await connection(); // depende de la sesión: nunca se prerenderiza
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { kind: "anonymous" };

  const [profile] = await db.select().from(userProfile).where(eq(userProfile.id, data.user.id));
  const [membership] = await db
    .select({
      id: agencyMember.id,
      agencyId: agencyMember.agencyId,
      role: agencyMember.role,
      status: agencyMember.status,
      agencyStatus: agency.status,
    })
    .from(agencyMember)
    .innerJoin(agency, eq(agency.id, agencyMember.agencyId))
    .where(and(eq(agencyMember.userId, data.user.id), eq(agencyMember.status, "active")));

  return buildActor(profile ?? null, membership ?? null);
});
