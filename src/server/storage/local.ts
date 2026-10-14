import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./index";

/** Resuelve una clave dentro de `root` o devuelve null si intenta salirse (../, rutas absolutas, bytes nulos). */
export function safeKeyPath(root: string, key: string): string | null {
  if (!key || key.includes("\0") || key.includes("\\") || path.isAbsolute(key)) return null;
  const base = path.resolve(root);
  const full = path.resolve(base, key);
  return full.startsWith(base + path.sep) ? full : null;
}

/**
 * Almacenamiento en disco para desarrollo. Las subidas van por PUT a /api/dev-upload/<clave>
 * y se sirven por GET en /media/<clave>. No usar en producción (ver getStorage).
 */
export class LocalStorage implements Storage {
  constructor(readonly root = process.env.LOCAL_MEDIA_DIR ?? ".local-media") {}

  private resolve(key: string) {
    const p = safeKeyPath(this.root, key);
    if (!p) throw new Error("Clave de almacenamiento inválida");
    return p;
  }
  async presignPut(key: string, contentType: string) {
    this.resolve(key);
    return { url: `/api/dev-upload/${key}`, headers: { "Content-Type": contentType } };
  }
  async getObject(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async putObject(key: string, body: Buffer, _contentType?: string) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async deleteObjects(keys: string[]) {
    for (const k of keys) await unlink(this.resolve(k)).catch((e: NodeJS.ErrnoException) => { if (e.code !== "ENOENT") throw e; });
  }
  async deletePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}
