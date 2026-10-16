"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicCardDto } from "@/contracts";
import { PublicCard } from "@/components/public/public-card";
import { getDict, localePath, type Locale } from "@/i18n";
import { useFavorites } from "@/lib/local-favorites";
import { favoriteCardsAction } from "./actions";

/** Lista de favoritos de este navegador. Las fichas que ya no son públicas simplemente no aparecen. */
export function FavoritesList({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const t = d.favorites;
  const slugs = useFavorites();
  const key = slugs.join(",");
  const [loaded, setLoaded] = useState<{ key: string; cards: PublicCardDto[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    favoriteCardsAction(key.split(","))
      .catch(() => [] as PublicCardDto[])
      .then((cards) => { if (alive) setLoaded({ key, cards }); });
    return () => { alive = false; };
  }, [key]);

  if (key && loaded?.key !== key) return <div aria-hidden className="skeleton h-64 w-full rounded-lg" />;
  const cards = key && loaded ? loaded.cards : [];
  if (cards.length === 0) {
    return (
      <p className="card muted">
        {t.empty} <strong>{t.emptyAction}</strong>.{" "}
        <Link href={localePath(locale, "/propiedades")} className="link">{d.site.seeProperties}</Link>
      </p>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((p) => <PublicCard key={p.id} p={p} locale={locale} />)}
    </div>
  );
}
