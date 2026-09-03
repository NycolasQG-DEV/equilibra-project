import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { surveyId, surveyType, answers, score, riskLevel } = body;

    if (!answers || score === undefined || !riskLevel) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const adminId = auth.user.admin_id;
    if (!adminId) {
      return NextResponse.json({ error: "Colaborador sem administrador vinculado." }, { status: 400 });
    }

    const responseId = crypto.randomUUID();
    const answersJson = typeof answers === "string" ? answers : JSON.stringify(answers);

    // Inserir resposta no banco SQL
    await execute(
      `INSERT INTO responses (id, user_id, admin_id, survey_id, survey_type, answers, score, risk_level, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [responseId, auth.userId, adminId, surveyId || null, surveyType || "questionario", answersJson, Number(score), String(riskLevel)]
    );

    // Atualizar assignment se houver surveyId
    if (surveyId) {
      await execute(
        `UPDATE survey_assignments
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE survey_id = $1 AND user_id = $2`,
        [surveyId, auth.userId]
      );
    }

    return NextResponse.json({ success: true, id: responseId });
  } catch (err: any) {
    console.error("Erro ao enviar respostas:", err);
    return NextResponse.json({ error: "Erro interno ao salvar resposta." }, { status: 500 });
  }
}
