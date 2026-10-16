"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getDict, type Locale } from "@/i18n";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

export type NavData = { initials: string; name: string; email: string; role: string } | null; // null = visitante sin sesión

/**
 * Último menú mostrado en ESTE navegador. Al cambiar de idioma el encabezado se vuelve a montar y el menú
 * (que se lee en el servidor) tarda un instante: mientras tanto se muestra el anterior, así no desaparece.
 * Solo se lee en el navegador, nunca en el servidor (ahí sería compartir datos entre usuarias).
 */
let last: NavData | undefined;

/** Al cerrar sesión: que el menú anterior no vuelva a mostrarse como relleno. */
export function clearNavCache() { last = undefined; }

function View({ data, locale }: { data: NavData; locale: Locale }) {
  const t = getDict(locale).site;
  if (!data) return <Link href="/login" className="btn">{t.login}</Link>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NavLink href="/panel">{t.myPanel}</NavLink>
      <UserMenu initials={data.initials} name={data.name} email={data.email} role={data.role} />
    </div>
  );
}

export function NavView({ data, locale }: { data: NavData; locale: Locale }) {
  useEffect(() => { last = data; }, [data]);
  return <View data={data} locale={locale} />;
}

/** Se muestra mientras el servidor resuelve la sesión. */
export function NavFallback({ locale }: { locale: Locale }) {
  const cached = typeof window !== "undefined" ? last : undefined;
  if (cached === undefined) return <span aria-hidden className="skeleton inline-block h-9 w-24 rounded-lg" />;
  return <View data={cached} locale={locale} />;
}
