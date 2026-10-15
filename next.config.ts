import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/csp";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    const common = securityHeaders({
      dev: process.env.NODE_ENV === "development",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mediaBaseUrl: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
      // el navegador sube directo a R2 con URL firmada (https://<cuenta>.r2.cloudflarestorage.com)
      uploadOrigin: process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
    });
    return [
      { source: "/:path*", headers: common },
      // el token de invitación viaja en la URL: que no se filtre por el Referer
      { source: "/invitacion/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
