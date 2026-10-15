"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localePath, stripLocale, type Locale } from "@/i18n";

const NAMES: Record<Locale, string> = { es: "Español", en: "English" };

/** Banderas en SVG: los emoji de bandera no se ven en Windows. */
function Flag({ locale }: { locale: Locale }) {
  return locale === "es" ? (
    <svg aria-hidden viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(15,23,42,0.2)]">
      <rect width="24" height="16" fill="#74acdf" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <circle cx="12" cy="8" r="1.7" fill="#f6b40e" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(15,23,42,0.2)]">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.4" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5.5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3.2" />
    </svg>
  );
}

const BTN = "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900";
const CHEVRON = "h-4 w-4 text-slate-500 transition-transform";

/** Mismo botón, sin interacción: ocupa el lugar mientras carga la ruta para que el encabezado no salte. */
export function LanguageSwitcherFallback({ locale }: { locale: Locale }) {
  return (
    <div className="relative">
      <span className={BTN}>
        <Flag locale={locale} /><span className="uppercase">{locale}</span>
        <svg aria-hidden viewBox="0 0 20 20" className={CHEVRON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7.5l5 5 5-5" /></svg>
      </span>
    </div>
  );
}

/** Desplegable de idioma con bandera. Mantiene la página y los filtros (la query se agrega al hacer clic). */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const path = stripLocale(usePathname());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox"
        aria-label={`${locale === "es" ? "Idioma" : "Language"}: ${NAMES[locale]}`}
        className={BTN}
      >
        <Flag locale={locale} />
        <span className="uppercase">{locale}</span>
        <svg aria-hidden viewBox="0 0 20 20" className={`${CHEVRON} ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7.5l5 5 5-5" /></svg>
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-300 bg-white p-1 shadow-lg">
          {(["es", "en"] as const).map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <Link
                href={localePath(l, path)} hrefLang={l} lang={l} prefetch={false}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  if (l !== locale) router.push(`${localePath(l, path)}${window.location.search}`);
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${l === locale ? "bg-blue-100 font-semibold text-blue-900" : "text-slate-900 hover:bg-slate-100"}`}
              >
                <Flag locale={l} />{NAMES[l]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
