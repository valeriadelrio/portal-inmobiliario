"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

/**
 * Estructura del área de usuario: menú lateral fijo en pantallas medianas y grandes; en celular
 * se pliega detrás de un botón "Menú". Es solo navegación: los permisos reales están en el servidor.
 */
export function AppShell({ groups, role, children }: { groups: NavGroup[]; role: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Menú de cuenta" className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = path === it.href || (!it.exact && path.startsWith(`${it.href}/`));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-blue-100 text-blue-900" : "text-slate-700 hover:bg-slate-200 hover:text-slate-900"}`}
                  >
                    <Icon name={it.icon} className={`h-5 w-5 shrink-0 ${active ? "text-blue-700" : "text-slate-500"}`} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-slate-200 px-3 pt-4">
        <p className="text-xs text-slate-500">Tu rol</p>
        <p className="badge mt-1 rounded-lg">{role}</p>
        <Link href="/propiedades" className="mt-4 flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
          <Icon name="globe" className="h-4 w-4" /> Ver el portal público
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-7xl md:grid md:min-h-[calc(100vh-4.1rem)] md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* celular: botón que despliega el menú */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <button type="button" className="btn px-3 py-1.5" aria-expanded={open} aria-controls="menu-movil" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "close" : "menu"} className="h-5 w-5" /> Menú
        </button>
        {open && <div id="menu-movil" className="pb-3 pt-3">{nav}</div>}
      </div>
      {/* pantallas medianas y grandes: barra lateral fija */}
      <aside className="hidden border-r border-slate-200 bg-white md:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto px-3 py-6">{nav}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
