import type { Metadata } from "next";
import { RootShell } from "@/components/root-shell";
import { getDict } from "@/i18n";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const t = getDict("es").site;

// Panel, administración, ingreso e invitaciones: solo en español, con el mismo encabezado.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "TERRAE — propiedades y lotes en Tandil", template: "%s | TERRAE" },
  description: t.description,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RootShell locale="es" switcher={false}>{children}</RootShell>;
}
