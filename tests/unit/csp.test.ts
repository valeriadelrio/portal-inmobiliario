import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "@/lib/csp";

describe("CSP", () => {
  it("producción: sin eval, sin ws, con upgrade-insecure-requests y bloqueos básicos", () => {
    const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co/", mediaBaseUrl: "https://media.ejemplo.com/x" });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("ws:");
    expect(csp).toContain("upgrade-insecure-requests");
    for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "default-src 'self'"]) expect(csp).toContain(d);
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co https://media.ejemplo.com");
    expect(csp).toContain("img-src 'self' data: blob: https://media.ejemplo.com");
    expect(csp).not.toMatch(/script-src[^;]*https:/); // ningún origen externo de scripts
  });
  it("desarrollo: permite eval y websocket (HMR) y no fuerza https", () => {
    const csp = buildCsp({ dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("ignora valores inválidos o relativos (/media)", () => {
    const csp = buildCsp({ mediaBaseUrl: "/media", supabaseUrl: "no es url" });
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("img-src 'self' data: blob:;");
  });
  it("cabeceras: HSTS solo en producción", () => {
    const keys = (dev: boolean) => securityHeaders({ dev }).map((h) => h.key);
    expect(keys(false)).toContain("Strict-Transport-Security");
    expect(keys(true)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toEqual(expect.arrayContaining(["Content-Security-Policy", "Permissions-Policy", "X-Frame-Options", "Cross-Origin-Opener-Policy"]));
  });
});
