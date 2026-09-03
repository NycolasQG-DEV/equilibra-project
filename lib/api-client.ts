import { getStoredToken } from "@/lib/auth-client";

/**
 * Faz uma requisição autenticada para as API Routes do Next.js.
 *
 * Automaticamente inclui o token JWT da sessão atual no header Authorization.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Utilitário seguro para extrair JSON de uma Response, prevenindo
 * o erro 'Unexpected token <, "<!DOCTYPE "... is not valid JSON' quando a API
 * retorna páginas HTML de erro (404/500).
 */
export async function parseResponseJson<T = any>(
  res: Response
): Promise<{ data: T | null; error: string | null }> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      data: null,
      error: `Servidor retornou resposta não-JSON (${res.status}).`,
    };
  }
  try {
    const json = await res.json();
    return {
      data: json,
      error: !res.ok ? (json?.error || `Erro do servidor (${res.status}).`) : null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err?.message || "Erro ao interpretar resposta do servidor.",
    };
  }
}

