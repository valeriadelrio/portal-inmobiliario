import type { Storage } from "./index";

export class MemoryStorage implements Storage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async presignPut(key: string, contentType: string, size: number) {
    return { url: `memory://${key}?size=${size}`, headers: { "Content-Type": contentType } };
  }
  async getObject(key: string) {
    return this.objects.get(key)?.body ?? null;
  }
  async putObject(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
  }
  async deleteObjects(keys: string[]) {
    for (const k of keys) this.objects.delete(k);
  }
  async deletePrefix(prefix: string) {
    for (const k of [...this.objects.keys()]) if (k.startsWith(prefix)) this.objects.delete(k);
  }
}
