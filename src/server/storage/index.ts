/** Almacenamiento de objetos (fotos). Hoy: memoria para desarrollo/tests; R2 lo agrega la pieza 2C. */
export interface Storage {
  presignPut(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> }>;
  getObject(key: string): Promise<Buffer | null>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

let instance: Storage | undefined;

export async function getStorage(): Promise<Storage> {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "memory";
  if (driver === "memory") {
    const { MemoryStorage } = await import("./memory");
    instance = new MemoryStorage();
  } else {
    throw new Error(`STORAGE_DRIVER "${driver}" no está implementado todavía (pieza 2C)`);
  }
  return instance;
}

export function resetStorageForTests() {
  instance = undefined;
}
