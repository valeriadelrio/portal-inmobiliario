import type { Instrumentation } from "next";
import { formatRequestError } from "@/lib/log-error";

/** Errores de servidor (render, Server Actions, rutas) → una línea JSON en los logs de producción. */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  console.error(JSON.stringify(formatRequestError(err, request, context)));
};
