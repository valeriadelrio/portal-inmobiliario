"use client";

import { Icon } from "@/components/icons";
import { getDict, type Locale } from "@/i18n";
import { toggleFavorite, useFavorites } from "@/lib/local-favorites";

/** Guarda la ficha en el navegador de la persona; no hace falta cuenta. */
export function FavoriteButton({ slug, locale }: { slug: string; locale: Locale }) {
  const t = getDict(locale).ficha;
  const fav = useFavorites().includes(slug);
  return (
    <button
      type="button" aria-pressed={fav} onClick={() => toggleFavorite(slug)}
      className={`btn w-full ${fav ? "border-rose-300 bg-rose-50 text-rose-700" : ""}`}
    >
      <Icon name="heart" className={`h-5 w-5 ${fav ? "fill-rose-500 text-rose-600" : ""}`} />
      {fav ? t.favSaved : t.favSave}
    </button>
  );
}
