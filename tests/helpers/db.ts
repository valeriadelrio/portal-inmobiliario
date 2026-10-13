import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";

/** Base de PRUEBAS. Nunca Supabase: se exige localhost. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://portal:portal@localhost:5433/portal_test";

export function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1"].includes(host))
    throw new Error(`Los tests de base de datos solo corren contra localhost (recibí "${host}").`);
}

export function testClients() {
  assertLocal(TEST_DATABASE_URL);
  const admin = postgres(TEST_DATABASE_URL, { onnotice: () => {} }); // dueño: salta RLS (siembra datos)
  return { admin, db: drizzle(admin, { schema }) };
}
