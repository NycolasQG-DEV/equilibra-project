import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession, saveReport, closeSurveyLink, logAuditAccess, maskProfileForEmployer } from "@/lib/ai/storage-mysql";
import { generateComprehensiveReport } from "@/lib/ai/groq-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(id);

    if (!session) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
    }

    const report = await generateComprehensiveReport(session);

    session.status = "completed";
    session.completedAt = new Date().toISOString();
    session.reportId = report.id;

    await saveSession(session);
    await saveReport(report);

    // Fecha automaticamente o link de pesquisa de uso único
    if (session.profile?.linkId) {
      await closeSurveyLink(session.profile.linkId, session.id);
    }

    await logAuditAccess({
      action: "REPORT_COMPILED",
      targetId: report.id,
      performedBy: "MOTOR_IA_NR01",
      sector: session.profile?.sector || "Geral",
      legalBasis: "NR-01 Item 1.5.7.3.2 / Portaria MTE nº 1.419/2024",
      details: `Relatório diagnóstico PGR compilado com sucesso para o setor ${session.profile?.sector}. Link ${session.profile?.linkId} concluído e encerrado.`,
    });

    return NextResponse.json({
      success: true,
      report: {
        ...report,
        profile: maskProfileForEmployer(report.profile, session.id),
      },
    });
  } catch (err: any) {
    console.error("Erro ao finalizar sessão e gerar relatório:", err);
    return NextResponse.json(
      { error: "Erro ao compilar o relatório final NR-1." },
      { status: 500 }
    );
  }
}
