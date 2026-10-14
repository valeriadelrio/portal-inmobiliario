import { isLocalStorageEnabled, getStorage } from "@/server/storage";

/** Sirve las fotos del almacenamiento LOCAL (desarrollo). En producción las sirve el CDN y esta ruta responde 404. */
const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };
const KEY = /^properties\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(400|800|1600)\.webp$/;

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isLocalStorageEnabled()) return new Response("No encontrado", { status: 404 });
  const key = (await ctx.params).path.join("/");
  if (!KEY.test(key)) return new Response("No encontrado", { status: 404 });
  const body = await (await getStorage()).getObject(key);
  if (!body) return new Response("No encontrado", { status: 404 });
  const ext = key.split(".").pop() ?? "";
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
