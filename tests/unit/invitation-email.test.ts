import { describe, expect, it } from "vitest";
import { buildAgencyStatusEmail } from "@/server/email/agency-status";
import { buildInvitationEmail } from "@/server/email/invitation";

describe("email de invitación", () => {
  it("incluye el enlace absoluto y el email al que está atada", () => {
    const m = buildInvitationEmail({ to: "ana@x.com", agencyName: "Casa Sur", role: "agent", link: "/invitacion/abc123" });
    expect(m.to).toBe("ana@x.com");
    expect(m.html).toContain("/invitacion/abc123");
    expect(m.html).toMatch(/href="https?:\/\//);
    expect(m.html).toContain("agente");
    expect(m.html).toContain("ana@x.com");
  });
  it("escapa el nombre de la inmobiliaria", () => {
    const m = buildInvitationEmail({ to: "a@x.com", agencyName: '<script>alert(1)</script>"', role: "agency_admin", link: "/invitacion/t" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("administrador");
  });
});

describe("aviso de cambio de estado de la inmobiliaria", () => {
  it("aprobada, reactivada, suspendida y rechazada dicen lo correcto e incluyen el motivo escapado", () => {
    const base = { to: "a@x.com", agencyName: "Casa <b>Uno</b>" };
    const ok = buildAgencyStatusEmail({ ...base, status: "approved" });
    expect(ok.subject).toContain("aprobada");
    expect(ok.html).not.toContain("<b>Uno</b>");
    expect(buildAgencyStatusEmail({ ...base, status: "approved", wasSuspended: true }).subject).toContain("reactivada");
    const sus = buildAgencyStatusEmail({ ...base, status: "suspended", reason: "Datos <script>falsos</script>" });
    expect(sus.html).toContain("Motivo");
    expect(sus.html).not.toContain("<script>");
    expect(buildAgencyStatusEmail({ ...base, status: "rejected" }).html).not.toContain("Motivo");
  });
});
