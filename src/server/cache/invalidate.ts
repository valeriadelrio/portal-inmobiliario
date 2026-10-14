import { updateTag } from "next/cache";

/** Refresca lo que ve el público tras un cambio. Solo se puede llamar desde Server Actions. */
export const invalidatePublic = () => updateTag("public-properties");
