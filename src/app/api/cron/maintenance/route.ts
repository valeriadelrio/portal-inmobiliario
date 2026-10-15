import { timingSafeEqual } from "node:crypto";
import { runMaintenance } from "@/server/maintenance";

/**
 * Mantenimiento diario (vercel.json → crons). Vercel manda `Authorization: Bearer $CRON_SECRET`.
 * Sin CRON_SECRET configurado la ruta no corre: nunca queda abierta.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET no configurado", { status: 503 });
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runMaintenance()) });
  } catch (e) {
    console.error("[maintenance] falló", e instanceof Error ? e.message : "error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
