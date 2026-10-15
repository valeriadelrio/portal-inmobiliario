import { en } from "./en";
import { es, type Dict } from "./es";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const isLocale = (x: unknown): x is Locale => typeof x === "string" && (LOCALES as readonly string[]).includes(x);
export const getDict = (locale: Locale): Dict => (locale === "en" ? en : es);

/** Español sin prefijo (URLs actuales, bueno para SEO); inglés bajo /en. */
export const localePath = (locale: Locale, path: string): string => (locale === "en" ? (path === "/" ? "/en" : `/en${path}`) : path);

/** Quita el prefijo /en de una ruta (para comparar con las rutas base). */
export const stripLocale = (path: string): string => path.replace(/^\/en(?=\/|$)/, "") || "/";

/** Etiqueta de zona según el idioma (cae al español si falta la traducción). */
export const zoneLabel = (locale: Locale, es_: string, en_?: string | null): string => (locale === "en" && en_ ? en_ : es_);

export const numberLocale = (locale: Locale) => (locale === "en" ? "en-US" : "es-AR");

export type { Dict };
