import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

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

    // 1. Links de pesquisa gerados
    const surveyLinks = await query(
      "SELECT id, title, sector, role, active, used, created_at FROM survey_links WHERE admin_id = $1 OR admin_id IS NULL ORDER BY created_at DESC",
      [adminId]
    );

    // 2. Respostas e laudos de sessões de IA
    const sessions = await query(
      "SELECT id, profile, is_completed, created_at FROM ai_sessions ORDER BY created_at DESC"
    );

    const activeLinksCount = surveyLinks.filter((l: any) => l.active && !l.used).length;
    const completedLinksCount = surveyLinks.filter((l: any) => l.used).length;
    const totalLinksCount = surveyLinks.length;

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const newThisMonth = surveyLinks.filter((l: any) => new Date(l.created_at).toISOString() >= startOfMonth).length;

    return NextResponse.json({
      colaboradores: totalLinksCount,
      maxColab: auth.user.max_colaboradores ?? 0,
      newThisMonth,
      responsesCount: sessions.filter((s: any) => s.is_completed).length || completedLinksCount,
      riskAlto: 0,
      surveysActive: activeLinksCount,
      recentLinks: surveyLinks.slice(0, 8),
      allLinks: surveyLinks,
    });
  } catch (err: any) {
    console.error("Erro ao carregar estatísticas do admin:", err);
    return NextResponse.json({ error: "Erro ao processar indicadores." }, { status: 500 });
  }
}
