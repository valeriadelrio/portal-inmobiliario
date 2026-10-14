import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal inmobiliario de Tandil",
  description: "Propiedades y lotes en venta y alquiler en Tandil, de varias inmobiliarias.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-300 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <Link href="/" className="font-semibold text-slate-900">Portal inmobiliario Tandil</Link>
            <Suspense fallback={<span className="muted text-sm">…</span>}>
              <SiteNav />
            </Suspense>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
