import { randomBytes } from "node:crypto";

/** "Casa en Villa Italia!" -> "casa-en-villa-italia" (sin acentos, minúsculas, guiones). */
export function slugify(text: string, maxLen = 60): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sin caracteres confusos
export function randomSuffix(len = 6): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Slug de propiedad: estable (se fija al crear) y único con sufijo aleatorio. */
export function propertySlug(title: string): string {
  return `${slugify(title, 50) || "propiedad"}-${randomSuffix()}`;
}
