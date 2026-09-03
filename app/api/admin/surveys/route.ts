import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { User } from "@/types/database";
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

    // Buscar pesquisas do admin
    const surveys = await query(
      "SELECT id, admin_id, title, description, questions, is_active, scheduled_at, ends_at, created_at, updated_at FROM surveys WHERE admin_id = $1 ORDER BY created_at DESC",
      [adminId]
    );

    const enriched = await Promise.all(
      surveys.map(async (survey: any) => {
        let parsedQuestions = survey.questions;
        if (typeof survey.questions === "string") {
          try {
            parsedQuestions = JSON.parse(survey.questions);
          } catch {
            parsedQuestions = [];
          }
        }

        const totalAssignedRow = await queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM survey_assignments WHERE survey_id = $1",
          [survey.id]
        );
        const totalCompletedRow = await queryOne<{ count: string }>(
          "SELECT COUNT(*) as count FROM survey_assignments WHERE survey_id = $1 AND status = 'completed'",
          [survey.id]
        );

        return {
          ...survey,
          questions: parsedQuestions,
          total_assigned: parseInt(totalAssignedRow?.count || "0", 10),
          total_completed: parseInt(totalCompletedRow?.count || "0", 10),
        };
      })
    );

    return NextResponse.json({ surveys: enriched });
  } catch (err: any) {
    console.error("Erro ao listar pesquisas:", err);
    return NextResponse.json({ error: "Erro interno ao buscar pesquisas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { adminId, title, description, questions, scheduledAt, endsAt, targetUserIds } = body;

    if (!adminId || !title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Campos obrigatórios: adminId, title, questions (array não vazio)." },
        { status: 400 }
      );
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    const admin = await queryOne<User>("SELECT id, role FROM users WHERE id = $1", [adminId]);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const surveyId = crypto.randomUUID();
    const cleanTitle = String(title).trim().slice(0, 255);
    const cleanDesc = String(description || "").trim().slice(0, 1000);
    const questionsJson = JSON.stringify(questions);
    const scheduledDate = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();
    const endsDate = endsAt ? new Date(endsAt).toISOString() : null;

    await execute(
      `INSERT INTO surveys (id, admin_id, title, description, questions, is_active, scheduled_at, ends_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [surveyId, adminId, cleanTitle, cleanDesc, questionsJson, scheduledDate, endsDate]
    );

    // Determinar colaboradores para atribuir
    let userIds: string[] = targetUserIds || [];
    if (!targetUserIds || targetUserIds.length === 0) {
      const colabs = await query<{ id: string }>(
        "SELECT id FROM users WHERE admin_id = $1 AND role = 'default'",
        [adminId]
      );
      userIds = colabs.map((c) => c.id);
    }

    // Criar assignments
    for (const uId of userIds) {
      const assignmentId = crypto.randomUUID();
      await execute(
        `INSERT INTO survey_assignments (id, survey_id, user_id, admin_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE id=id`,
        [assignmentId, surveyId, uId, adminId]
      );
    }

    return NextResponse.json({
      success: true,
      survey: { id: surveyId, title: cleanTitle, description: cleanDesc },
      assigned_count: userIds.length,
    });
  } catch (err: any) {
    console.error("Erro ao criar pesquisa:", err);
    return NextResponse.json({ error: "Erro interno ao criar pesquisa." }, { status: 500 });
  }
}
