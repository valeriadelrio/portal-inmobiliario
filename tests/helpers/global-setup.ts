import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { assertLocal, TEST_DATABASE_URL } from "./db";

/** Crea portal_test si no existe y le aplica TODAS las migraciones (incluida RLS). */
export default async function setup() {
  assertLocal(TEST_DATABASE_URL);
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const root = postgres(adminUrl.toString(), { onnotice: () => {}, connect_timeout: 10 });
  try {
    const found = await root`select 1 from pg_database where datname = ${dbName}`;
    if (!found.length) await root.unsafe(`create database "${dbName}"`);
  } catch (e) {
    throw new Error(
      "No pude conectar a Postgres local para los tests. ¿Está corriendo `docker compose up -d`? " + String(e),
    );
  } finally {
    await root.end();
  }

  const conn = postgres(TEST_DATABASE_URL, { onnotice: () => {}, max: 1 });
  await migrate(drizzle(conn), { migrationsFolder: "db/migrations" });
  await conn.end();
}
