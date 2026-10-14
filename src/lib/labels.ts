import type { PublishBlocker } from "@/contracts";

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

export function statusLabel(status: string, operation: string): string {
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
export function formatPrice(price: number, currency: string): string {
  const n = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(price);
  return currency === "USD" ? `US$ ${n}` : `$ ${n}`;
}
