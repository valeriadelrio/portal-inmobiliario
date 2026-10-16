"use server";

import type { PublicCardDto } from "@/contracts";
import { listPublicCardsBySlugs } from "@/server/services/public";

/** Fichas públicas para los favoritos guardados en el navegador. Endpoint público: solo recibe slugs. */
export async function favoriteCardsAction(slugs: string[]): Promise<PublicCardDto[]> {
  if (!Array.isArray(slugs)) return [];
  const r = await listPublicCardsBySlugs(slugs.filter((s): s is string => typeof s === "string"));
  return r.ok ? r.data : [];
}
