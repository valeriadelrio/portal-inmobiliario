"use client";

import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./logout-button";

type Props = { initials: string; name: string; email: string; role: string };

/** Avatar con iniciales + desplegable con los datos de la cuenta y "Cerrar sesión". */
export function UserMenu({ initials, name, email, role }: Props) {
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
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left hover:bg-slate-200"
      >
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">
          {initials}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-900">{name}</span>
          <span className="block text-xs text-slate-600">{role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-10 mt-2 w-72 space-y-3 shadow-lg">
          <div>
            <p className="font-medium">{name}</p>
            <p className="muted break-all text-sm">{email}</p>
            <p className="badge mt-2">{role}</p>
          </div>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
