"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = path === href || (!exact && path.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-blue-100 text-blue-900" : "text-slate-700 hover:bg-slate-200 hover:text-slate-900"}`}
    >
      {children}
    </Link>
  );
}
