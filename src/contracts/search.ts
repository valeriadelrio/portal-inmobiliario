import { z } from "zod";
import { CURRENCY, OPERATION, PROPERTY_TYPE } from "./enums";

const csv = (s: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(s));

export const searchFilters = z.object({
  op: z.enum(OPERATION).optional(),
  type: csv(z.enum(PROPERTY_TYPE)).optional(),
  zone: csv(z.string()).optional(),
  currency: z.enum(CURRENCY).default("USD"),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minRooms: z.coerce.number().int().nonnegative().optional(),
  minArea: z.coerce.number().nonnegative().optional(),
  maxArea: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
  page: z.coerce.number().int().positive().default(1),
});
export type SearchFilters = z.infer<typeof searchFilters>;
