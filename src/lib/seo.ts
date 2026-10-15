import type { Metadata } from "next";
import { localePath, type Locale } from "@/i18n";

/** Canonical + versiones en cada idioma (hreflang) de una página pública. `path` es la ruta sin prefijo de idioma. */
export function alternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localePath(locale, path),
    languages: { es: localePath("es", path), en: localePath("en", path), "x-default": localePath("es", path) },
  };
}
