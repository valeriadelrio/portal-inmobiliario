import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell } from "@/components/root-shell";
import { LOCALES, getDict, isLocale } from "@/i18n";
import { siteUrl } from "@/lib/site";
import "../globals.css";

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).site;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.nameLong, template: `%s | ${t.nameLong}` },
    description: t.description,
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RootShell locale={locale} switcher>{children}</RootShell>;
}
