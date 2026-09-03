import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TokenPayload } from "@/lib/auth/jwt";
import { queryOne } from "@/lib/db";
import { User } from "@/types/database";

export interface AuthResult {
  userId: string;
  email: string;
  role: string;
  name: string;
  plan: string;
  user: User;
}

/**
 * Verifica a autenticação de uma API Route via JWT token.
 *
 * Extrai o token JWT do header Authorization, valida a assinatura e expiração,
 * busca o usuário no banco de dados SQL e opcionalmente valida a identidade esperada.
 */
export async function verifyAuth(
  request: NextRequest,
  expectedUserId?: string
): Promise<AuthResult | NextResponse> {
  // 1. Extrair o token do header Authorization ou dos cookies
  let token: string | null = null;
  const authHeader = request.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "").trim();
  } else {
    const cookieToken = request.cookies.get("equilibra_auth_token")?.value;
    if (cookieToken) {
      token = cookieToken.trim();
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "Token de autenticação não fornecido." },
      { status: 401 }
    );
  }

  // 2. Verificar e decodificar o token JWT
  const payload = verifyToken(token);

  if (!payload || !payload.userId) {
    return NextResponse.json(
      { error: "Sessão expirada ou inválida. Faça login novamente." },
      { status: 401 }
    );
  }

  // 3. Buscar usuário no banco de dados para garantir integridade
  const user = await queryOne<User>(
    "SELECT id, name, email, role, plan, max_colaboradores, admin_id, cargo, setor, observacao, created_at, updated_at FROM users WHERE id = $1",
    [payload.userId]
  );

  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 401 }
    );
  }

  // 4. Se um expectedUserId foi fornecido, verificar que corresponde
  if (expectedUserId && user.id !== expectedUserId) {
    return NextResponse.json(
      { error: "Acesso negado. Identidade não corresponde." },
      { status: 403 }
    );
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    plan: user.plan,
    user,
  };
}

/**
 * Helper para verificar se o resultado de verifyAuth é um NextResponse de erro.
 */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
