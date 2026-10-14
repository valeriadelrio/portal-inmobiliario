/**
 * Número tal como lo escribe una persona en Argentina: "120000", "120.000", "1.250,50", "45,5".
 * Vacío -> undefined; algo que no es número -> NaN (el esquema lo rechaza).
 */
export function parseNumber(raw: FormDataEntryValue | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).replace(/[\s$]|US|USD|ARS/gi, "");
  if (s === "") return undefined;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}
