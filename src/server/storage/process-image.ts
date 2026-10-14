import sharp from "sharp";
import { PHOTO_WIDTHS } from "@/contracts";

export type ProcessedImage = { width: number; height: number; variants: Record<(typeof PHOTO_WIDTHS)[number], Buffer> };

const FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const MAX_PIXELS = 50_000_000;

/**
 * Valida que el archivo sea una imagen real (no confía en el tipo declarado), respeta la orientación EXIF,
 * elimina los metadatos (p. ej. GPS) y genera las variantes WebP sin agrandar la original.
 * Lanza si no es una imagen soportada.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const base = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" });
  const meta = await base.metadata();
  if (!meta.format || !FORMATS.has(meta.format)) throw new Error("unsupported_format");
  const rotated = await base.clone().rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = rotated.info;
  const variants = {} as ProcessedImage["variants"];
  for (const w of PHOTO_WIDTHS) {
    variants[w] = await sharp(rotated.data).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  }
  return { width, height, variants };
}
