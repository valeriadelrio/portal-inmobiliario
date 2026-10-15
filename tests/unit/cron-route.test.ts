import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/maintenance", () => ({ runMaintenance: async () => ({ abandonedUploads: 0, scrubbed: 0, anonymizedInquiries: 0 }) }));
import { GET } from "@/app/api/cron/maintenance/route";

const call = (auth?: string) => GET(new Request("http://localhost/api/cron/maintenance", { headers: auth ? { authorization: auth } : {} }));
afterEach(() => vi.unstubAllEnvs());

describe("ruta de mantenimiento", () => {
  it("sin CRON_SECRET no corre nunca", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(503);
    expect((await call()).status).toBe(503);
  });
  it("rechaza credenciales ausentes o incorrectas", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer otro")).status).toBe(401);
    expect((await call("secreto-largo")).status).toBe(401);
  });
  it("con el secreto correcto ejecuta y responde los totales", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo");
    const res = await call("Bearer secreto-largo");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, abandonedUploads: 0, scrubbed: 0, anonymizedInquiries: 0 });
  });
});
