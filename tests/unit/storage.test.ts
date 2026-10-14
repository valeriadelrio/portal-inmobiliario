import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStorage, safeKeyPath } from "@/server/storage/local";
import { processImage } from "@/server/storage/process-image";

const jpeg = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#369" } }).jpeg().toBuffer();

describe("safeKeyPath", () => {
  it("acepta claves normales y rechaza escapes", () => {
    const root = "/tmp/media";
    expect(safeKeyPath(root, "properties/a/b/c/800.webp")).toBe("/tmp/media/properties/a/b/c/800.webp");
    for (const bad of ["../etc/passwd", "a/../../x", "/etc/passwd", "a\\b", "a\0b", "", ".."]) expect(safeKeyPath(root, bad)).toBeNull();
  });
});

describe("LocalStorage", () => {
  let dir: string | undefined;
  afterAll(async () => dir && rm(dir, { recursive: true, force: true }));
  it("guarda, lee, borra y limpia por prefijo", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "media-"));
    const s = new LocalStorage(dir);
    await s.putObject("p/1/a.webp", Buffer.from("A"), "image/webp");
    await s.putObject("p/1/b.webp", Buffer.from("B"), "image/webp");
    expect((await s.getObject("p/1/a.webp"))?.toString()).toBe("A");
    expect(await s.getObject("p/1/nada.webp")).toBeNull();
    await s.deleteObjects(["p/1/a.webp", "p/1/no-existe.webp"]);
    expect(await s.getObject("p/1/a.webp")).toBeNull();
    await s.deletePrefix("p/1");
    expect(await s.getObject("p/1/b.webp")).toBeNull();
    await expect(s.putObject("../fuera", Buffer.from("x"), "x")).rejects.toThrow();
  });
});

describe("processImage", () => {
  it("genera 3 variantes WebP sin agrandar la original", async () => {
    const r = await processImage(await jpeg(2000, 1000));
    expect([r.width, r.height]).toEqual([2000, 1000]);
    const widths = await Promise.all([400, 800, 1600].map(async (w) => (await sharp(r.variants[w as 400]).metadata()).width));
    expect(widths).toEqual([400, 800, 1600]);
    const small = await processImage(await jpeg(500, 300));
    expect((await sharp(small.variants[1600]).metadata()).width).toBe(500); // no se agranda
    expect((await sharp(small.variants[800]).metadata()).format).toBe("webp");
  });
  it("respeta la orientación EXIF y elimina metadatos", async () => {
    const tagged = await sharp(await jpeg(400, 200)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const r = await processImage(tagged);
    expect([r.width, r.height]).toEqual([200, 400]); // rotada
    expect((await sharp(r.variants[400]).metadata()).exif).toBeUndefined();
  });
  it("rechaza lo que no es una imagen (aunque diga serlo)", async () => {
    await expect(processImage(Buffer.from("esto no es una imagen"))).rejects.toThrow();
    await expect(processImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).rejects.toThrow();
  });
});
