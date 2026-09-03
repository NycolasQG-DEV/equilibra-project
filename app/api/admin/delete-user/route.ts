import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { User } from "@/types/database";

export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { adminId, userId } = body;

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    if (!adminId || !userId) {
      return NextResponse.json({ error: "adminId e userId são obrigatórios." }, { status: 400 });
    }

    const admin = await queryOne<User>("SELECT id, role FROM users WHERE id = $1", [adminId]);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const target = await queryOne<User>("SELECT id, admin_id, role FROM users WHERE id = $1", [userId]);
    if (!target) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    if (target.admin_id !== adminId) {
      return NextResponse.json({ error: "Este colaborador não pertence a você." }, { status: 403 });
    }

    if (target.role === "admin") {
      return NextResponse.json({ error: "Não é possível remover um administrador." }, { status: 403 });
    }

    // A remoção em cascata (ON DELETE CASCADE) apagará responses, assignments e chat_messages vinculados
    await execute("DELETE FROM users WHERE id = $1", [userId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao remover colaborador:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
