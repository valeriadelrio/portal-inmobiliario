import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/admin", "/api", "/login", "/invitacion", "/registro-agencia"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
