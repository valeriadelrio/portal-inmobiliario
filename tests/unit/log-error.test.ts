import { describe, expect, it } from "vitest";
import { formatRequestError } from "@/lib/log-error";

describe("formatRequestError", () => {
  it("usa la ruta con parámetros y nunca la URL real (puede llevar un token)", () => {
    const out = formatRequestError(new Error("boom"), { method: "GET", path: "/invitacion/SECRETO?x=1" } as never, { routePath: "/invitacion/[token]", routeType: "render" });
    const text = JSON.stringify(out);
    expect(text).not.toContain("SECRETO");
    expect(out).toMatchObject({ level: "error", route: "/invitacion/[token]", type: "render", method: "GET", name: "Error", message: "boom" });
  });
  it("recorta mensajes largos y toma el código de Postgres de la causa", () => {
    const err = Object.assign(new Error("x".repeat(500)), { cause: { code: "23505" }, digest: "d1" });
    const out = formatRequestError(err, {}, {});
    expect(out.message).toHaveLength(200);
    expect(out).toMatchObject({ code: "23505", digest: "d1", route: "?" });
  });
  it("tolera valores que no son Error", () => {
    expect(formatRequestError("texto", {}, {})).toMatchObject({ name: "string", message: "texto" });
    expect(formatRequestError(null, {}, {})).toMatchObject({ message: "null" });
  });
});
