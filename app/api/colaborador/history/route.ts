import { NextRequest, NextResponse } from "next/server";
import { query, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    // 1. Respostas do colaborador com título da pesquisa associada
    const responses = await query(
      `SELECT r.id, r.user_id, r.admin_id, r.survey_id, r.survey_type, r.score, r.risk_level, r.created_at, s.title as survey_title
       FROM responses r
       LEFT JOIN surveys s ON s.id = r.survey_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [auth.userId]
    );

    const formattedResponses = responses.map((r: any) => ({
      ...r,
      surveys: {
        title: r.survey_title || "Questionário NR-1",
      },
    }));

    // 2. Mensagens agrupadas por sessão
    const msgs = await query(
      "SELECT session_id, created_at FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC",
      [auth.userId]
    );

    const grouped = msgs.reduce<Record<string, { count: number; last: string }>>((acc, m: any) => {
      if (!acc[m.session_id]) acc[m.session_id] = { count: 0, last: m.created_at };
      acc[m.session_id].count++;
      return acc;
    }, {});

    const sessions = Object.entries(grouped).map(([session_id, v]) => ({ session_id, ...v }));

    return NextResponse.json({
      responses: formattedResponses,
      sessions,
    });
  } catch (err: any) {
    console.error("Erro ao obter histórico do colaborador:", err);
    return NextResponse.json({ error: "Erro ao buscar histórico." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });
    }

    await execute(
      "DELETE FROM chat_messages WHERE user_id = $1 AND session_id = $2",
      [auth.userId, sessionId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao apagar conversa:", err);
    return NextResponse.json({ error: "Erro ao remover conversa." }, { status: 500 });
  }
}
