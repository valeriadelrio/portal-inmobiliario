import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Actor } from "@/contracts";
import type * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Corre `fn` en una transacción como el rol `app_user` (sujeto a RLS) con el id del usuario.
 * Solo se pasa el userId: la agencia y el rol los deriva la BASE, no el cliente ni el Actor.
 */
export function runAsActor<T>(database: Database, actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const userId = actor.kind === "user" ? actor.userId : "";
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
