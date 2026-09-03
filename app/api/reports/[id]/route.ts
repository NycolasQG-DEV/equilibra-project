import { NextRequest, NextResponse } from "next/server";
import { getReport, logAuditAccess, maskProfileForEmployer } from "@/lib/ai/storage-mysql";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const report = await getReport(id);
    if (!report) {
      return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    }

    await logAuditAccess({
      action: "ADMIN_VIEW_REPORT_DETAIL",
      targetId: report.id,
      performedBy: "GESTOR_SESMT_CIPA",
      sector: report.profile?.sector || "Geral",
      legalBasis: "NR-01 Item 1.5.5.2 (Plano de Ação do PGR)",
      details: `Visualização de relatório técnico do PGR (ID: ${report.id}).`,
    });

    return NextResponse.json({
      ...report,
      profile: maskProfileForEmployer(report.profile, report.sessionId || report.id),
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao carregar relatório." }, { status: 500 });
  }
}
