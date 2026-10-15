import type { PublishBlocker } from "@/contracts";
import { getDict, numberLocale, type Locale } from "@/i18n";

export const TYPE_LABEL: Record<string, string> = {
  house: "Casa", apartment: "Departamento", ph: "PH", lot: "Lote", commercial: "Local comercial", office: "Oficina", garage: "Cochera",
};
export const OPERATION_LABEL: Record<string, string> = { sale: "Venta", rent: "Alquiler" };
export const LOT_SERVICE_LABEL: Record<string, string> = {
  water: "Agua", electricity: "Luz", gas: "Gas", sewer: "Cloacas", asphalt: "Asfalto",
};
export const BLOCKER_LABEL: Record<PublishBlocker, string> = {
  min_photos: "Cargá al menos 3 fotos",
  no_cover: "Elegí una foto de portada",
  zone_inactive: "La zona elegida está inactiva: elegí otra",
  agency_not_approved: "Tu inmobiliaria todavía no está aprobada",
};

export function statusLabel(status: string, operation: string, locale: Locale = "es"): string {
  if (locale !== "es") {
    const d = getDict(locale).status;
    if (status === "active") return d.active;
    if (status === "reserved") return d.reserved;
    if (status === "sold_rented") return operation === "rent" ? d.soldRent : d.soldSale;
  }
  switch (status) {
    case "draft": return "Borrador";
    case "active": return "Activa";
    case "reserved": return "Reservada";
    case "sold_rented": return operation === "rent" ? "Alquilada" : "Vendida";
    case "paused": return "Pausada";
    default: return status;
  }
}

/** Sin conversión entre monedas: cada precio se muestra en la moneda en que se cargó. */
export function formatPrice(price: number, currency: string, locale: Locale = "es"): string {
  const n = new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 0 }).format(price);
  return currency === "USD" ? `US$ ${n}` : `$ ${n}`;
}
