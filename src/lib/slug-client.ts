/** Versión para el navegador de slugify (src/lib/slug.ts usa node:crypto y no puede ir al cliente). */
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
