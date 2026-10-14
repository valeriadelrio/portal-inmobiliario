import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { cachedSlugs } from "@/server/cache/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const r = await cachedSlugs();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/propiedades`, changeFrequency: "hourly", priority: 0.9 },
    ...(r.ok ? r.data.map((p) => ({ url: `${base}/propiedades/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })) : []),
  ];
}
