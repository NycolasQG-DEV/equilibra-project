import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return NextResponse.json({ error: "adminId é obrigatório." }, { status: 400 });
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    // Buscar pesquisas do admin
    const { data: surveys, error } = await supabaseAdmin
      .from("surveys")
      .select("*")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buscar contagem de assignments por pesquisa
    const surveyIds = (surveys ?? []).map((s: { id: string }) => s.id);
    const enriched = await Promise.all(
      (surveys ?? []).map(async (survey: { id: string }) => {
        const { count: totalAssigned } = await supabaseAdmin
          .from("survey_assignments")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", survey.id);

        const { count: totalCompleted } = await supabaseAdmin
          .from("survey_assignments")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", survey.id)
          .eq("status", "completed");

        return {
          ...survey,
          total_assigned: totalAssigned ?? 0,
          total_completed: totalCompleted ?? 0,
        };
      })
    );

    return NextResponse.json({ surveys: enriched });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Verificar que é admin
    const { data: admin } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", adminId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Criar pesquisa
    const { data: survey, error: surveyErr } = await supabaseAdmin
      .from("surveys")
      .insert([{
        admin_id: adminId,
        title: String(title).trim().slice(0, 255),
        description: String(description || "").trim().slice(0, 1000),
        questions,
        is_active: true,
        scheduled_at: scheduledAt || new Date().toISOString(),
        ends_at: endsAt || null,
      }])
      .select("*")
      .single();

    if (surveyErr || !survey) {
      return NextResponse.json({ error: surveyErr?.message || "Erro ao criar pesquisa." }, { status: 500 });
    }

    // Determinar quais colaboradores receberão a pesquisa
    let userIds: string[] = targetUserIds || [];

    if (!targetUserIds || targetUserIds.length === 0) {
      // Enviar para TODOS os colaboradores do admin
      const { data: colabs } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("admin_id", adminId)
        .eq("role", "default");

      userIds = (colabs ?? []).map((u: { id: string }) => u.id);
    }

    // Criar assignments
    if (userIds.length > 0) {
      const assignments = userIds.map((userId: string) => ({
        survey_id: survey.id,
        user_id: userId,
        admin_id: adminId,
        status: "pending",
      }));

      const { error: assignErr } = await supabaseAdmin
        .from("survey_assignments")
        .insert(assignments);

      if (assignErr) {
        return NextResponse.json({
          error: "Pesquisa criada, mas erro ao atribuir colaboradores: " + assignErr.message,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      survey,
      assigned_count: userIds.length,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
