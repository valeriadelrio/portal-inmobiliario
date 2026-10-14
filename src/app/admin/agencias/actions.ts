"use server";

import { revalidatePath } from "next/cache";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { setAgencyStatus } from "@/server/services/agency";

const ALLOWED = ["approved", "rejected", "suspended"] as const;

export async function statusAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const status = String(f.get("status") ?? "");
  if (!(ALLOWED as readonly string[]).includes(status)) return { ok: false, message: "Estado inválido." };
  const r = await setAgencyStatus(
    await getActor(), String(f.get("id") ?? ""), status as (typeof ALLOWED)[number], String(f.get("reason") ?? "").trim() || undefined,
  );
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/admin/agencias");
  return { ok: true, message: "Estado actualizado." };
}
