import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db/client";
import { userProfile } from "@/server/db/schema";

/** Datos de presentación del usuario logueado (nombre y email). Solo se llama con el userId del actor. */
export const getProfileSummary = cache(async (userId: string) => {
  const [p] = await db
    .select({ email: userProfile.email, fullName: userProfile.fullName })
    .from(userProfile)
    .where(eq(userProfile.id, userId));
  return p ?? null;
});
