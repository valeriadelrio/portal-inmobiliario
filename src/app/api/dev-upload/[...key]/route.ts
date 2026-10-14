import { MAX_BYTES } from "@/contracts";
import { getStorage, isLocalStorageEnabled } from "@/server/storage";

/**
 * Recibe la subida directa del navegador SOLO con almacenamiento local (desarrollo).
 * Con R2 el navegador sube directo a Cloudflare con una URL firmada y esta ruta no existe.
 * Solo acepta claves de originales con el formato que genera requestPhotoUpload.
 */
const KEY = /^properties\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/original$/;

export async function PUT(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorageEnabled()) return new Response("No encontrado", { status: 404 });
  const key = (await ctx.params).key.join("/");
  if (!KEY.test(key)) return new Response("Clave inválida", { status: 400 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return new Response("Archivo demasiado grande", { status: 413 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX_BYTES) return new Response("Tamaño inválido", { status: 413 });
  await (await getStorage()).putObject(key, body, req.headers.get("content-type") ?? "application/octet-stream");
  return new Response(null, { status: 200 });
}
