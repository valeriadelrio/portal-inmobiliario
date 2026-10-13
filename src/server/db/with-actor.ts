import type { Actor } from "@/contracts";
import { db } from "./client";
import { runAsActor, type Tx } from "./run-as-actor";

/** Único punto de acceso a datos de negocio desde la app. Siempre sujeto a RLS. */
export function withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runAsActor(db, actor, fn);
}
