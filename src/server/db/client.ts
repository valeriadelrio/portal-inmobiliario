import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");

// En desarrollo cada recarga en caliente volvía a evaluar este módulo y abría otro pool, hasta agotar las conexiones de
// Supabase (EMAXCONNSESSION: las fichas pasaban a "no encontrada"). Se reutiliza el mismo cliente y se cierran las conexiones ociosas.
const g = globalThis as typeof globalThis & { __terraeSql?: ReturnType<typeof postgres> };
export const sql = g.__terraeSql ?? postgres(url, { idle_timeout: 20 });
if (process.env.NODE_ENV !== "production") g.__terraeSql = sql;
export const db = drizzle(sql, { schema });
