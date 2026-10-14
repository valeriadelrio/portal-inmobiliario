"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublic } from "@/server/cache/invalidate";
import { redirect } from "next/navigation";
import { PROPERTY_STATUS, propertyInput, type PropertyStatus } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { parsePropertyForm } from "@/lib/property-form";
import { getActor } from "@/server/auth/get-actor";
import { changeStatus, createProperty, deleteProperty, updateProperty } from "@/server/services/property";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const INVALID = "Revisá los datos: título (5+ letras), descripción (20+), zona, precio, superficie y los campos obligatorios del tipo elegido.";

export async function saveProperty(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = propertyInput.safeParse(parsePropertyForm(f));
  if (!parsed.success) return { ok: false, message: INVALID };
  const id = s(f, "id");
  if (id) {
    const r = await updateProperty(actor, id, parsed.data);
    if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
    revalidatePath(`/panel/propiedades/${id}`);
    invalidatePublic();
    return { ok: true, message: "Cambios guardados." };
  }
  const r = await createProperty(actor, parsed.data, s(f, "agentId") || undefined);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/propiedades");
  invalidatePublic();
  redirect(`/panel/propiedades/${r.data.id}`);
}

export async function statusAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const status = s(f, "status");
  if (!(PROPERTY_STATUS as readonly string[]).includes(status)) return { ok: false, message: "Estado inválido." };
  const id = s(f, "id");
  const r = await changeStatus(await getActor(), id, status as PropertyStatus);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath(`/panel/propiedades/${id}`);
  invalidatePublic();
  revalidatePath("/panel/propiedades");
  invalidatePublic();
  return { ok: true, message: "Estado actualizado." };
}

export async function deleteAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const r = await deleteProperty(await getActor(), s(f, "id"));
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/propiedades");
  invalidatePublic();
  redirect("/panel/propiedades");
}
