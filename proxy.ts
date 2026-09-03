import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Se o usuário estiver na home ('/') e já possuir o cookie de autenticação, redireciona direto para /admin
  if (pathname === "/") {
    const token = request.cookies.get("equilibra_auth_token")?.value;
    if (token && token.trim().length > 10) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  const response = NextResponse.next();

  // Impedir que páginas protegidas sejam cacheadas pelo navegador
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

// Suporte para versões do Next.js
export const middleware = proxy;

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/colaborador/:path*",
    "/dev/:path*",
    "/planos/:path*",
  ],
};
