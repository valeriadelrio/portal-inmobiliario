"use client";

import { useState, useTransition } from "react";
import { toggleFavoriteAction } from "@/app/[locale]/propiedades/[slug]/actions";
import { Icon } from "@/components/icons";
import { getDict, type Locale } from "@/i18n";

export function FavoriteButton({ propertyId, initial, locale }: { propertyId: string; initial: boolean; locale: Locale }) {
  const t = getDict(locale).ficha;
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending} aria-pressed={fav}
      onClick={() => { const next = !fav; setFav(next); start(async () => { const r = await toggleFavoriteAction(propertyId, next); if (!r.ok) setFav(!next); }); }}
      className={`btn ${fav ? "border-rose-300 bg-rose-50 text-rose-700" : ""}`}
    >
      <Icon name="heart" className={`h-5 w-5 ${fav ? "fill-rose-500 text-rose-600" : ""}`} />
      {fav ? t.favSaved : t.favSave}
    </button>
  );
}
