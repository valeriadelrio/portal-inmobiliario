"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAgencyInput } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { registerAgency } from "@/server/services/agency";

export async function registerAgencyAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = registerAgencyInput.safeParse({
    name: String(f.get("name") ?? ""),
    slug: String(f.get("slug") ?? ""),
    phone: String(f.get("phone") ?? "") || undefined,
    email: String(f.get("email") ?? "") || undefined,
    displayName: String(f.get("displayName") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "Revisá los datos: nombre, dirección (minúsculas y guiones) y tu nombre son obligatorios." };
  const r = await registerAgency(actor, parsed.data);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/", "layout"); // el rol cambió: refresca el avatar del encabezado y el menú
  redirect("/panel/agencia");
}
