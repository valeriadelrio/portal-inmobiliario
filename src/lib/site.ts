/** URL pública del sitio (para enlaces absolutos, sitemap y metadatos). */
export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
