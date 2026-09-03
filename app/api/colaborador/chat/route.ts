import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    // Buscar a última sessão ou histórico da sessão ativa
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    let sessionToLoad = sessionId;

    if (!sessionToLoad) {
      const lastMsg = await queryOne<{ session_id: string }>(
        "SELECT session_id FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [auth.userId]
      );
      sessionToLoad = lastMsg?.session_id || null;
    }

    if (!sessionToLoad) {
      return NextResponse.json({ history: [], sessionId: null });
    }

    const history = await query(
      "SELECT id, user_id, session_id, role, text, created_at FROM chat_messages WHERE user_id = $1 AND session_id = $2 ORDER BY created_at ASC",
      [auth.userId, sessionToLoad]
    );

    return NextResponse.json({ history, sessionId: sessionToLoad });
  } catch (err: any) {
    console.error("Erro ao buscar chat do colaborador:", err);
    return NextResponse.json({ error: "Erro ao buscar histórico do chat." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { sessionId, role, text } = body;

    if (!sessionId || !role || !text) {
      return NextResponse.json({ error: "Campos obrigatórios: sessionId, role, text" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO chat_messages (id, user_id, session_id, role, text, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)",
      [id, auth.userId, sessionId, role, String(text).trim()]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Erro ao salvar mensagem:", err);
    return NextResponse.json({ error: "Erro ao salvar mensagem." }, { status: 500 });
  }
}
