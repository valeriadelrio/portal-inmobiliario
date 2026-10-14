import { z } from "zod";
import { slugSchema } from "./agency";

export const zoneInput = z.object({
  slug: slugSchema,
  nameEs: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type ZoneInput = z.infer<typeof zoneInput>;

/** Fila del CSV db/seeds/zones.csv: slug,name_es,name_en,parent_slug,sort_order,is_active */
export const zoneCsvRow = z.object({
  slug: slugSchema,
  name_es: z.string().trim().min(2),
  name_en: z.string().trim().optional().default(""),
  parent_slug: z.string().trim().optional().default(""),
  sort_order: z.coerce.number().int().default(0),
  is_active: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
});
export type ZoneCsvRow = z.infer<typeof zoneCsvRow>;

export type ZoneDto = {
  id: string; slug: string; nameEs: string; nameEn: string | null; parentId: string | null;
  sortOrder: number; isActive: boolean;
};
