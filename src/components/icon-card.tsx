import Link from "next/link";
import { Icon, type IconName } from "./icons";

/** Tarjeta de acceso rápido: ícono de lo que trata + título + descripción. */
export function IconCard({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: string }) {
  return (
    <Link href={href} className="card group flex items-start gap-4 hover:border-blue-700 hover:shadow-sm">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 group-hover:bg-blue-700 group-hover:text-white">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="muted mt-1 block text-sm">{text}</span>
      </span>
    </Link>
  );
}
