"use server";

import { revalidatePath } from "next/cache";
import { INQUIRY_STATUS, type InquiryStatus } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { setInquiryStatus } from "@/server/services/inquiry";

export async function inquiryStatusAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const status = String(f.get("status") ?? "") as InquiryStatus;
  if (!INQUIRY_STATUS.includes(status)) return { ok: false, message: "Estado inválido." };
  const r = await setInquiryStatus(await getActor(), String(f.get("id") ?? ""), status);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/consultas");
  return { ok: true, message: "Actualizada." };
}
