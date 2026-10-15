/** Lo que ve el público (sin sesión). Nunca incluye emails de cuentas, coordenadas ni direcciones ocultas. */
export type PublicCardDto = {
  id: string; slug: string; title: string; operation: string; type: string; status: string;
  price: number; currency: string; zoneName: string; zoneNameEn: string | null; totalAreaM2: number;
  bedrooms: number | null; bathrooms: number | null; coverKey: string | null; photoCount: number;
  agencyName: string; agencySlug: string;
};

export type PublicAgentDto = {
  id: string; displayName: string | null; bio: string | null; photoUrl: string | null;
  publicPhone: string | null; publicWhatsapp: string | null; publicEmail: string | null;
};

export type PublicPropertyDto = PublicCardDto & {
  description: string; language: string; publishedAt: string | null; updatedAt: string;
  zoneParentName: string | null; zoneParentNameEn: string | null;
  /** Solo si el agente marcó "mostrar dirección exacta". */
  address: string | null; expenses: number | null; coveredAreaM2: number | null;
  detail:
    | { kind: "lot"; frontageM: number | null; depthM: number | null; services: string[]; zoning: string | null; isCorner: boolean }
    | {
        kind: "building"; rooms: number; bedrooms: number; bathrooms: number; garages: number; ageYears: number | null;
        floor: number | null; hasElevator: boolean | null; furnished: boolean | null; amenities: string[];
      };
  photos: { id: string; storageKey: string; altText: string | null; isCover: boolean }[];
  agent: PublicAgentDto | null;
  agency: { name: string; slug: string; logoUrl: string | null; phone: string | null; website: string | null };
};
