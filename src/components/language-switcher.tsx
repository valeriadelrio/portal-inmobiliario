"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getDict, localePath, stripLocale, type Locale } from "@/i18n";

/** Cambia entre español e inglés manteniendo la página y los filtros. */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const path = stripLocale(usePathname());
  const qs = useSearchParams().toString();
  const other: Locale = locale === "es" ? "en" : "es";
  return (
    <Link
      href={`${localePath(other, path)}${qs ? `?${qs}` : ""}`} hrefLang={other} lang={other} prefetch={false}
      aria-label={`${getDict(other).site.language}: ${other === "en" ? "English" : "Español"}`}
      className="rounded-md px-3 py-1.5 text-sm font-medium uppercase text-slate-700 hover:bg-slate-200 hover:text-slate-900"
    >
      {other}
    </Link>
  );
}
