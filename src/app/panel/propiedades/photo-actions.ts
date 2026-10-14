"use server";

import { revalidatePath } from "next/cache";
import { errorText } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { confirmPhotoUpload, deletePhoto, reorderPhotos, requestPhotoUpload, setCover } from "@/server/services/photo";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (code: string, message: string): { ok: false; message: string } => ({ ok: false, message: errorText(code, message) });
const refresh = (propertyId?: string) => {
  if (propertyId) revalidatePath(`/panel/propiedades/${propertyId}`);
  revalidatePath("/panel/propiedades");
};

export async function requestUploadAction(propertyId: string, mime: string, size: number): Promise<Result<{ photoId: string; url: string; headers: Record<string, string> }>> {
  const r = await requestPhotoUpload(await getActor(), propertyId, mime, size);
  if (!r.ok) return { ok: false, message: r.error.code === "validation" || r.error.code === "max_photos" ? photoMessage(r.error.code, r.error.message) : errorText(r.error.code, r.error.message) };
  return { ok: true, ...r.data };
}

export async function confirmUploadAction(propertyId: string, photoId: string): Promise<Result> {
  const r = await confirmPhotoUpload(await getActor(), photoId);
  if (!r.ok) return { ok: false, message: r.error.code === "validation" || r.error.code === "storage" ? r.error.message : errorText(r.error.code, r.error.message) };
  refresh(propertyId);
  return { ok: true };
}

export async function setCoverAction(propertyId: string, photoId: string): Promise<Result> {
  const r = await setCover(await getActor(), photoId);
  if (!r.ok) return fail(r.error.code, r.error.message);
  refresh(propertyId);
  return { ok: true };
}

export async function deletePhotoAction(propertyId: string, photoId: string): Promise<Result> {
  const r = await deletePhoto(await getActor(), photoId);
  if (!r.ok) {
    return { ok: false, message: r.error.code === "publish_blocked" ? "La propiedad publicada necesita al menos 3 fotos y una portada. Cambiá la portada o pausá la propiedad antes de borrar." : errorText(r.error.code, r.error.message) };
  }
  refresh(propertyId);
  return { ok: true };
}

export async function reorderAction(propertyId: string, photoIds: string[]): Promise<Result> {
  const r = await reorderPhotos(await getActor(), propertyId, photoIds);
  if (!r.ok) return fail(r.error.code, r.error.message);
  refresh(propertyId);
  return { ok: true };
}

function photoMessage(code: string, message: string) {
  return code === "max_photos" ? "Alcanzaste el máximo de 30 fotos por propiedad." : message;
}
