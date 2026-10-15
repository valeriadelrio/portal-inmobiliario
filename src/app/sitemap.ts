import type { MetadataRoute } from "next";
import { localePath, LOCALES } from "@/i18n";
import { siteUrl } from "@/lib/site";
import { cachedSlugs } from "@/server/cache/public";

/** Cada página pública aparece en español e inglés, con sus alternativas (hreflang). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const r = await cachedSlugs();
  const entry = (path: string, o: { lastModified?: string; changeFrequency: "hourly" | "daily" | "weekly"; priority: number }) =>
    LOCALES.map((l) => ({
      url: `${base}${localePath(l, path)}`, ...o,
      alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${base}${localePath(x, path)}`])) },
    }));
  return [
    ...entry("/", { changeFrequency: "daily", priority: 1 }),
    ...entry("/propiedades", { changeFrequency: "hourly", priority: 0.9 }),
    ...(r.ok ? r.data.flatMap((p) => entry(`/propiedades/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 })) : []),
  ];
}
