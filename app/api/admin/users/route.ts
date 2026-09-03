import { NextRequest, NextResponse } from "next/server";
import { query, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { User } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return NextResponse.json({ error: "adminId é obrigatório." }, { status: 400 });
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    // Busca o admin e todos os colaboradores vinculados a ele
    const users = await query<User>(
      `SELECT id, name, email, role, plan, max_colaboradores, admin_id, cargo, setor, observacao, created_at, updated_at
       FROM users
       WHERE admin_id = $1 OR id = $1
       ORDER BY created_at DESC`,
      [adminId]
    );

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("Erro ao buscar usuários:", err);
    return NextResponse.json({ error: "Erro interno ao buscar usuários." }, { status: 500 });
  }
}
