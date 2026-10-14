"use server";

import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import { zoneCsvRow, zoneInput } from "@/contracts";
import { getActor } from "@/server/auth/get-actor";
import { createZone, deleteZone, importZonesFromCsv, updateZone } from "@/server/services/zone";

export type FormState = { ok: boolean; message: string } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

function readZone(f: FormData) {
  return zoneInput.safeParse({
    slug: text(f, "slug"),
    nameEs: text(f, "nameEs"),
    nameEn: text(f, "nameEn") || undefined,
    parentId: text(f, "parentId") || null,
    sortOrder: Number(text(f, "sortOrder") || 0),
    isActive: f.get("isActive") === "on",
  });
}

/** Cada acción es un endpoint público: verifica la sesión por su cuenta (el servicio re-verifica permisos). */
export async function saveZone(_prev: FormState, f: FormData): Promise<FormState> {
  const actor = await getActor();
  const parsed = readZone(f);
  if (!parsed.success) return { ok: false, message: "Revisá los datos: el slug usa minúsculas y guiones, y el nombre necesita 2+ letras." };
  const id = text(f, "id");
  const r = id ? await updateZone(actor, id, parsed.data) : await createZone(actor, parsed.data);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/admin/zonas");
  return { ok: true, message: id ? "Zona actualizada" : "Zona creada" };
}

export async function removeZone(_prev: FormState, f: FormData): Promise<FormState> {
  const r = await deleteZone(await getActor(), text(f, "id"));
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/admin/zonas");
  return { ok: true, message: "Zona eliminada" };
}

export async function importCsv(_prev: FormState, f: FormData): Promise<FormState> {
  const actor = await getActor();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elegí un archivo CSV" };
  if (file.size > 1_000_000) return { ok: false, message: "El archivo es demasiado grande" };
  let rows;
  try {
    const raw = parse(Buffer.from(await file.arrayBuffer()), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as unknown[];
    rows = raw.map((r, i) => {
      const p = zoneCsvRow.safeParse(r);
      if (!p.success) throw new Error(`Fila ${i + 2}: ${p.error.issues[0]?.path.join(".")} inválido`);
      return p.data;
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo leer el CSV" };
  }
  const r = await importZonesFromCsv(actor, rows);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/admin/zonas");
  return { ok: true, message: `Importación lista: ${r.data.created} nuevas, ${r.data.updated} actualizadas` };
}

function errorText(code: string, message: string): string {
  switch (code) {
    case "forbidden": return "No tenés permiso para esto";
    case "conflict": return "Ya existe una zona con ese slug";
    case "in_use": return "La zona está en uso (propiedades o subzonas). Desactivala en lugar de borrarla";
    case "zone_depth": return "Las zonas solo admiten 2 niveles (zona y subzona)";
    case "not_found": return "La zona no existe";
    case "validation": return message;
    default: return "Ocurrió un error inesperado";
  }
}
