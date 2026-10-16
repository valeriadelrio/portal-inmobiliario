import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n";
import { FavoritesList } from "./favorites-list";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).favorites.title : undefined, robots: { index: false } };
}

export default async function FavoritosPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale).favorites;
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="muted mt-1 text-sm">{t.note}</p>
      </div>
      <FavoritesList locale={locale} />
    </main>
  );
}
