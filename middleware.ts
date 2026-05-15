import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware de segurança — adiciona headers de proteção em rotas protegidas.
 *
 * NOTA: O Supabase JS client armazena sessões no localStorage (client-side),
 * não em cookies. Por isso, a verificação de autenticação real acontece no
 * hook useAuth() em cada página protegida. Este middleware apenas adiciona
 * headers de segurança extras (no-cache) para páginas sensíveis.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Impedir que páginas protegidas sejam cacheadas pelo navegador
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/colaborador/:path*",
    "/dev/:path*",
    "/planos/:path*",
  ],
};
