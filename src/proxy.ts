import { createServerClient } from "@supabase/ssr";
import { stripLocale } from "@/i18n";
import { safeNext } from "@/lib/safe-redirect";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/panel", "/admin", "/cuenta", "/registro-agencia"];
// páginas públicas con idioma: el español va sin prefijo (se reescribe a /es/…) y el inglés bajo /en
const LOCALIZED = ["/propiedades", "/inmobiliarias", "/cuenta", "/favoritos", "/privacidad"];
const isLocalized = (p: string) => p === "/" || LOCALIZED.some((l) => p === l || p.startsWith(`${l}/`));

/** Refresca la sesión de Supabase y manda a /login si falta. La autorización fina NO va acá (ver policies.ts). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const bare = stripLocale(path); // sin el prefijo /en

  if (!data.user && PROTECTED.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (data.user && path === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(safeNext(next), request.url));
  }

  // /es/... no es una URL pública: el español vive sin prefijo
  if (path === "/es" || path.startsWith("/es/")) {
    const url = request.nextUrl.clone();
    url.pathname = path.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (!path.startsWith("/en") && isLocalized(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `/es${path === "/" ? "" : path}`;
    const rewritten = NextResponse.rewrite(url, { request });
    response.cookies.getAll().forEach((c) => rewritten.cookies.set(c));
    return rewritten;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
