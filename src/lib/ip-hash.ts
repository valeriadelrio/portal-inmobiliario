import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Hash de la IP del visitante (con sal): sirve para limitar abusos sin guardar la IP. */
export async function requestIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.IP_HASH_SALT ?? "dev-salt"}:${ip}`).digest("hex").slice(0, 32);
}
