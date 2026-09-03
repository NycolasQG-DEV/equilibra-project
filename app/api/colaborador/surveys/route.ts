import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    // Se passou surveyId específico, busca dados detalhados da pesquisa
    if (surveyId) {
      const survey = await queryOne(
        "SELECT id, admin_id, title, description, questions, is_active FROM surveys WHERE id = $1 AND is_active = true",
        [surveyId]
      );

      if (!survey) {
        return NextResponse.json({ error: "Pesquisa não encontrada ou inativa." }, { status: 404 });
      }

      let parsedQuestions = survey.questions;
      if (typeof survey.questions === "string") {
        try {
          parsedQuestions = JSON.parse(survey.questions);
        } catch {
          parsedQuestions = [];
        }
      }

      return NextResponse.json({
        survey: {
          ...survey,
          questions: parsedQuestions,
        },
      });
    }

    // Busca a primeira pesquisa pendente atribuída ao colaborador
    const pendingAssignment = await queryOne(
      `SELECT sa.id as assignment_id, sa.survey_id, sa.status, s.title, s.description, s.questions
       FROM survey_assignments sa
       INNER JOIN surveys s ON s.id = sa.survey_id
       WHERE sa.user_id = $1 AND sa.status = 'pending' AND s.is_active = true
       ORDER BY sa.created_at ASC
       LIMIT 1`,
      [auth.userId]
    );

    if (!pendingAssignment) {
      return NextResponse.json({ pending: null });
    }

    let parsedQuestions = pendingAssignment.questions;
    if (typeof pendingAssignment.questions === "string") {
      try {
        parsedQuestions = JSON.parse(pendingAssignment.questions);
      } catch {
        parsedQuestions = [];
      }
    }

    return NextResponse.json({
      pending: {
        id: pendingAssignment.assignment_id,
        survey_id: pendingAssignment.survey_id,
        status: pendingAssignment.status,
        surveys: {
          title: pendingAssignment.title,
          description: pendingAssignment.description,
          questions: parsedQuestions,
        },
      },
    });
  } catch (err: any) {
    console.error("Erro ao buscar pesquisas do colaborador:", err);
    return NextResponse.json({ error: "Erro interno ao buscar pesquisas." }, { status: 500 });
  }
}
