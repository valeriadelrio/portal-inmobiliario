import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getDict, localePath, type Locale } from "@/i18n";
import { LanguageSwitcher, LanguageSwitcherFallback } from "./language-switcher";
import { NavFallback } from "./nav-view";
import { SiteNav } from "./site-nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** <html>, <body> y encabezado común. Lo usan los dos layouts raíz: el público con idioma y el del panel (siempre en español). */
export function RootShell({ locale, switcher, children }: { locale: Locale; switcher: boolean; children: React.ReactNode }) {
  const t = getDict(locale).site;
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-300 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href={localePath(locale, "/")} className="font-semibold text-slate-900">
              <span className="sm:hidden">{t.nameShort}</span><span className="hidden sm:inline">{t.nameLong}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={localePath(locale, "/propiedades")} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900">{t.properties}</Link>
              <Suspense fallback={<NavFallback locale={locale} />}>
                <SiteNav locale={locale} />
              </Suspense>
              {switcher && <Suspense fallback={<LanguageSwitcherFallback locale={locale} />}><LanguageSwitcher locale={locale} /></Suspense>}
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-300 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-slate-600 sm:px-6">
            <span>{t.nameLong}</span>
            <Link href={localePath(locale, "/privacidad")} className="link">{getDict(locale).privacy.footerLink}</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
