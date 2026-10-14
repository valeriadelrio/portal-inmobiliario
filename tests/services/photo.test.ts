import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { confirmPhotoUpload, deletePhoto, listPhotos, reorderPhotos, requestPhotoUpload, setCover, updateAltText } from "@/server/services/photo";
import { changeStatus, deleteProperty } from "@/server/services/property";
import { getStorage } from "@/server/storage";
import type { MemoryStorage } from "@/server/storage/memory";
import { AG, ANON, M, P, U, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const member = (userId: string, agencyId: string, memberId: string, role: "agent" | "agency_admin"): Actor => ({
  kind: "user", userId, platformAdmin: false, membership: { agencyId, memberId, role },
});
const admA = member(U.admA, AG.A, M.admA, "agency_admin");
const a1 = member(U.a1, AG.A, M.a1, "agent");
const a2 = member(U.a2, AG.A, M.a2, "agent");
const b1 = member(U.b1, AG.B, M.b1, "agent");
const visitor = asUser(U.visitor);
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error!.code);
const image = () => sharp({ create: { width: 1200, height: 800, channels: 3, background: "#963" } }).jpeg().toBuffer();

const store = async () => (await getStorage()) as MemoryStorage;

/** Simula el recorrido completo: pedir URL, subir el archivo y confirmar. */
async function upload(actor: Actor, propertyId: string, body?: Buffer) {
  const req = await requestPhotoUpload(actor, propertyId, "image/jpeg", 1000);
  if (!req.ok) return req;
  const row = (await admin`select storage_key from property_photo where id = ${req.data.photoId}`)[0];
  await (await store()).putObject(`${row.storage_key}/original`, body ?? (await image()), "image/jpeg");
  return confirmPhotoUpload(actor, req.data.photoId);
}

describe("subida", () => {
  it("el recorrido completo deja la foto lista con 3 variantes y la primera como portada", async () => {
    await admin`delete from property_photo where property_id = ${P.a1draft}`;
    const r1 = await upload(a1, P.a1draft);
    const r2 = await upload(a1, P.a1draft);
    if (!r1.ok || !r2.ok) throw new Error("falló");
    expect(r1.data).toMatchObject({ status: "ready", isCover: true, width: 1200, height: 800, position: 0 });
    expect(r2.data).toMatchObject({ isCover: false, position: 1 });
    const keys = [...(await store()).objects.keys()].filter((k) => k.startsWith(r1.data.storageKey));
    expect(keys.sort()).toEqual([1600, 400, 800].map((w) => `${r1.data.storageKey}/${w}.webp`));
    expect(r1.data.storageKey).toBe(`properties/${AG.A}/${P.a1draft}/${r1.data.id}`);
  });
  it("rechaza formatos y tamaños inválidos antes de crear nada", async () => {
    expect(code(await requestPhotoUpload(a1, P.a1draft, "application/pdf", 100))).toBe("validation");
    expect(code(await requestPhotoUpload(a1, P.a1draft, "image/jpeg", 11 * 1024 * 1024))).toBe("validation");
    expect(code(await requestPhotoUpload(a1, P.a1draft, "image/jpeg", 0))).toBe("validation");
    expect((await admin`select count(*)::int n from property_photo where property_id = ${P.a1draft}`)[0].n).toBe(1); // la del seed
  });
  it("un archivo que no es imagen se descarta y no queda fila pendiente", async () => {
    const before = (await admin`select count(*)::int n from property_photo`)[0].n;
    const r = await upload(a1, P.a1draft, Buffer.from("no soy una imagen"));
    expect(code(r)).toBe("validation");
    expect((await admin`select count(*)::int n from property_photo`)[0].n).toBe(before);
  });
  it("confirmar sin haber subido el archivo falla con storage", async () => {
    const req = await requestPhotoUpload(a1, P.a1draft, "image/jpeg", 1000);
    if (!req.ok) throw new Error("falló");
    expect(code(await confirmPhotoUpload(a1, req.data.photoId))).toBe("storage");
  });
  it("máximo 30 fotos por propiedad", async () => {
    await admin`delete from property_photo where property_id = ${P.a1draft}`;
    await admin`insert into property_photo (property_id, agency_id, storage_key, position) select ${P.a1draft}, ${AG.A}, 'k'||g, g from generate_series(1,30) g`;
    expect(code(await requestPhotoUpload(a1, P.a1draft, "image/jpeg", 1000))).toBe("max_photos");
  });
  it("aislamiento: no se sube a fichas ajenas, de otra inmobiliaria ni sin sesión", async () => {
    expect(code(await requestPhotoUpload(a2, P.a1draft, "image/jpeg", 10))).not.toBe("ok");
    expect(code(await requestPhotoUpload(b1, P.a1draft, "image/jpeg", 10))).toBe("not_found");
    expect(code(await requestPhotoUpload(visitor, P.a1draft, "image/jpeg", 10))).toBe("forbidden");
    expect(code(await requestPhotoUpload(ANON, P.a1draft, "image/jpeg", 10))).toBe("unauthenticated");
    expect((await requestPhotoUpload(admA, P.a1draft, "image/jpeg", 10)).ok).toBe(true); // su admin sí
  });
  it("un compañero no puede confirmar la subida pendiente de otro", async () => {
    const req = await requestPhotoUpload(a1, P.a1draft, "image/jpeg", 1000);
    if (!req.ok) throw new Error("falló");
    const key = (await admin`select storage_key from property_photo where id = ${req.data.photoId}`)[0].storage_key;
    await (await store()).putObject(`${key}/original`, await image(), "image/jpeg");
    expect(code(await confirmPhotoUpload(a2, req.data.photoId))).toBe("not_found");
    expect((await admin`select status from property_photo where id = ${req.data.photoId}`)[0].status).toBe("pending");
  });
});

describe("portada, orden, alt y borrado", () => {
  async function three(propertyId = P.a1draft) {
    await admin`delete from property_photo where property_id = ${propertyId}`;
    const out: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await upload(a1, propertyId);
      if (!r.ok) throw new Error(r.error.message);
      out.push(r.data.id);
    }
    return out;
  }
  it("cambia la portada y siempre hay una sola", async () => {
    const [p1, , p3] = await three();
    expect((await setCover(a1, p3)).ok).toBe(true);
    const rows = await admin`select id from property_photo where property_id = ${P.a1draft} and is_cover`;
    expect(rows.map((r) => r.id)).toEqual([p3]);
    void p1;
    expect(code(await setCover(a2, p3))).toBe("not_found");
    expect(code(await setCover(b1, p3))).toBe("not_found");
  });
  it("reordena y valida que la lista sea exactamente la de la propiedad", async () => {
    const [p1, p2, p3] = await three();
    expect((await reorderPhotos(a1, P.a1draft, [p3, p1, p2])).ok).toBe(true);
    const l = await listPhotos(a1, P.a1draft);
    expect(l.ok && l.data.map((p) => p.id)).toEqual([p3, p1, p2]);
    expect(code(await reorderPhotos(a1, P.a1draft, [p3, p1]))).toBe("validation");
    expect(code(await reorderPhotos(a1, P.a1draft, [p3, p1, p1]))).toBe("validation");
    expect(code(await reorderPhotos(a1, P.a1draft, [p3, p1, "00000000-0000-4000-8000-0000000000aa"]))).toBe("validation");
    expect(code(await reorderPhotos(a2, P.a1draft, [p1, p2, p3]))).not.toBe("ok");
  });
  it("texto alternativo: lo guarda, lo limita y respeta permisos", async () => {
    const [p1] = await three();
    expect((await updateAltText(a1, p1, "  Frente de la casa ")).ok).toBe(true);
    expect((await admin`select alt_text from property_photo where id = ${p1}`)[0].alt_text).toBe("Frente de la casa");
    expect(code(await updateAltText(a1, p1, "x".repeat(201)))).toBe("validation");
    expect(code(await updateAltText(b1, p1, "hack"))).toBe("not_found");
  });
  it("borrar: elimina archivos; si era la portada de un borrador, la siguiente la reemplaza", async () => {
    const [p1, p2] = await three();
    const key = (await admin`select storage_key from property_photo where id = ${p1}`)[0].storage_key;
    expect((await deletePhoto(a1, p1)).ok).toBe(true);
    expect([...(await store()).objects.keys()].filter((k) => k.startsWith(key))).toEqual([]);
    expect((await admin`select is_cover from property_photo where id = ${p2}`)[0].is_cover).toBe(true);
    expect(code(await deletePhoto(a2, p2))).toBe("not_found");
    expect(code(await deletePhoto(b1, p2))).toBe("not_found");
  });
  it("en una ficha publicada no baja de 3 fotos ni se borra la portada", async () => {
    const ids = await three(P.a1draft);
    await admin`insert into property_photo (property_id, agency_id, storage_key, position, status) values (${P.a1draft}, ${AG.A}, 'extra', 9, 'ready')`;
    expect((await changeStatus(a1, P.a1draft, "active")).ok).toBe(true);
    expect(code(await deletePhoto(a1, ids[0]))).toBe("publish_blocked"); // es la portada
    expect(code(await deletePhoto(a1, ids[1]))).toBe("ok"); // quedan 3
    expect(code(await deletePhoto(a1, ids[2]))).toBe("publish_blocked"); // quedarían 2
  });
  it("listPhotos: el público ve solo las listas", async () => {
    await admin`insert into property_photo (property_id, agency_id, storage_key, status) values (${P.a1}, ${AG.A}, 'pend', 'pending')`;
    const pub = await listPhotos(ANON, P.a1);
    expect(pub.ok && pub.data.every((p) => p.status === "ready")).toBe(true);
    const own = await listPhotos(a1, P.a1);
    expect(own.ok && own.data.some((p) => p.status === "pending")).toBe(true);
  });
});

describe("con propiedades", () => {
  it("al eliminar una propiedad se borran sus archivos", async () => {
    await admin`delete from property_photo where property_id = ${P.a1draft}`;
    const r = await upload(a1, P.a1draft);
    if (!r.ok) throw new Error("falló");
    expect([...(await store()).objects.keys()].some((k) => k.startsWith(`properties/${AG.A}/${P.a1draft}/`))).toBe(true);
    expect((await deleteProperty(a1, P.a1draft)).ok).toBe(true);
    expect([...(await store()).objects.keys()].some((k) => k.startsWith(`properties/${AG.A}/${P.a1draft}/`))).toBe(false);
  });
  it("con 3 fotos listas y portada la ficha se publica (cierra el circuito de 2B)", async () => {
    await admin`delete from property_photo where property_id = ${P.a1draft}`;
    for (let i = 0; i < 3; i++) await upload(a1, P.a1draft);
    expect((await changeStatus(a1, P.a1draft, "active")).ok).toBe(true);
  });
});
