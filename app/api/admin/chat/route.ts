import { NextRequest, NextResponse } from "next/server";
import { query, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import crypto from "crypto";

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

    const history = await query(
      "SELECT id, admin_id, role, text, created_at FROM admin_chat_messages WHERE admin_id = $1 ORDER BY created_at ASC LIMIT 100",
      [adminId]
    );

    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao buscar histórico do chat." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { adminId, role, text } = body;

    if (!adminId || !role || !text) {
      return NextResponse.json({ error: "Campos obrigatórios: adminId, role, text" }, { status: 400 });
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO admin_chat_messages (id, admin_id, role, text, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)",
      [id, adminId, role, String(text).trim()]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao salvar mensagem do chat." }, { status: 500 });
  }
}
