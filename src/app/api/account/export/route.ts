import { getActor } from "@/server/auth/get-actor";
import { exportMyData } from "@/server/services/account";

/** Descarga de los datos de la persona que está logueada (derecho de acceso, Ley 25.326). */
export async function GET() {
  const r = await exportMyData(await getActor());
  if (!r.ok) return new Response("Tenés que iniciar sesión", { status: r.error.code === "unauthenticated" ? 401 : 404 });
  return new Response(JSON.stringify(r.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mis-datos.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
