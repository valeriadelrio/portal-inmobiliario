import { z } from "zod";

export const PHOTO_WIDTHS = [400, 800, 1600] as const;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 30; // igual que photo_guard en la base

export const presignInput = z.object({
  propertyId: z.string().uuid(),
  mime: z.enum(ALLOWED_MIME),
  size: z.number().int().positive().max(MAX_BYTES),
});
export const reorderInput = z.object({
  propertyId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1).max(MAX_PHOTOS),
});

export type PhotoDto = {
  id: string; propertyId: string; storageKey: string; position: number; isCover: boolean;
  status: "pending" | "ready"; altText: string | null; width: number | null; height: number | null;
};
