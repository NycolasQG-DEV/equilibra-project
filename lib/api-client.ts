import { supabase } from "@/lib/supabase";

/**
 * Faz uma requisição autenticada para as API Routes.
 *
 * Automaticamente inclui o token JWT da sessão atual no header
 * Authorization. Se não houver sessão, lança um erro.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Content-Type", "application/json");

  return fetch(url, {
    ...options,
    headers,
  });
}
