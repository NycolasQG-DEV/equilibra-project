import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface AuthResult {
  userId: string;
  email: string;
}

/**
 * Verifica a autenticação de uma API Route.
 *
 * Extrai o token JWT do header Authorization, valida com Supabase,
 * e opcionalmente verifica que o userId do token corresponde ao
 * adminId enviado no body do request.
 *
 * @returns O userId autenticado, ou um NextResponse de erro.
 */
export async function verifyAuth(
  request: NextRequest,
  expectedUserId?: string
): Promise<AuthResult | NextResponse> {
  // 1. Extrair o token do header Authorization
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Token de autenticação não fornecido." },
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "");

  if (!token || token.length < 10) {
    return NextResponse.json(
      { error: "Token de autenticação inválido." },
      { status: 401 }
    );
  }

  // 2. Verificar o token com Supabase
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json(
      { error: "Sessão expirada ou inválida. Faça login novamente." },
      { status: 401 }
    );
  }

  // 3. Se um expectedUserId foi fornecido, verificar que corresponde
  if (expectedUserId && user.id !== expectedUserId) {
    return NextResponse.json(
      { error: "Acesso negado. Identidade não corresponde." },
      { status: 403 }
    );
  }

  return {
    userId: user.id,
    email: user.email ?? "",
  };
}

/**
 * Helper para checar se o resultado do verifyAuth é um erro.
 */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
