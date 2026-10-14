/** Almacenamiento de objetos (fotos). Hoy: memoria para desarrollo/tests; R2 lo agrega la pieza 2C. */
export interface Storage {
  presignPut(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> }>;
  getObject(key: string): Promise<Buffer | null>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

let instance: Storage | undefined;

/**
 * memory (tests) | local (desarrollo, disco) | r2 (producción, pendiente).
 * Sin STORAGE_DRIVER: desarrollo usa local, tests usan memory y producción exige configurarlo.
 */
export async function getStorage(): Promise<Storage> {
  if (instance) return instance;
  const env = process.env.NODE_ENV;
  const driver = process.env.STORAGE_DRIVER || (env === "development" ? "local" : env === "test" ? "memory" : "");
  if (driver === "memory") {
    const { MemoryStorage } = await import("./memory");
    instance = new MemoryStorage();
  } else if (driver === "local") {
    if (env === "production") throw new Error("STORAGE_DRIVER=local no se puede usar en producción");
    const { LocalStorage } = await import("./local");
    instance = new LocalStorage();
  } else {
    throw new Error(`STORAGE_DRIVER "${driver}" no está implementado todavía (R2 llega cuando haya cuenta de Cloudflare)`);
  }
  return instance;
}

/** ¿Estamos sirviendo y recibiendo fotos desde el disco local? (rutas /media y /api/dev-upload) */
export const isLocalStorageEnabled = () =>
  process.env.NODE_ENV !== "production" && (process.env.STORAGE_DRIVER || (process.env.NODE_ENV === "development" ? "local" : "")) === "local";

export function resetStorageForTests() {
  instance = undefined;
}
