import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { User } from "@/types/database";

const MAX_FIELD_LENGTH = 255;

function sanitize(value: string, maxLen = MAX_FIELD_LENGTH): string {
  return String(value).trim().slice(0, maxLen);
}

export async function PUT(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { adminId, userId, name, cargo, setor, observacao } = body;

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    if (!adminId || !userId) {
      return NextResponse.json({ error: "adminId e userId são obrigatórios." }, { status: 400 });
    }

    const admin = await queryOne<User>("SELECT id, role FROM users WHERE id = $1", [adminId]);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const target = await queryOne<User>("SELECT id, admin_id FROM users WHERE id = $1", [userId]);
    if (!target) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    if (target.admin_id !== adminId) {
      return NextResponse.json({ error: "Este colaborador não pertence a sua organização." }, { status: 403 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      const cleanName = sanitize(name);
      if (cleanName.length < 2) {
        return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
      }
      updates.push(`name = $${paramIndex++}`);
      params.push(cleanName);
    }

    if (cargo !== undefined) {
      updates.push(`cargo = $${paramIndex++}`);
      params.push(sanitize(cargo));
    }

    if (setor !== undefined) {
      updates.push(`setor = $${paramIndex++}`);
      params.push(sanitize(setor));
    }

    if (observacao !== undefined) {
      updates.push(`observacao = $${paramIndex++}`);
      params.push(sanitize(observacao, 1000));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nenhum campo informado para atualização." }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    const updateSql = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, name, email, role, plan, cargo, setor, observacao, updated_at`;
    const updated = await queryOne<User>(updateSql, params);

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    console.error("Erro ao atualizar colaborador:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
