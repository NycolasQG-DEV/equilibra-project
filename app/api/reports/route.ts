import { NextRequest, NextResponse } from "next/server";
import { listReports, logAuditAccess, maskProfileForEmployer } from "@/lib/ai/storage-mysql";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector") || undefined;

    const reports = await listReports(sector);

    await logAuditAccess({
      action: "ADMIN_LIST_REPORTS",
      performedBy: "GESTOR_SESMT_CIPA",
      legalBasis: "NR-01 Item 1.5.7.1 (Documentação do PGR)",
      details: `Listagem consolidada de ${reports.length} relatórios técnicos acessada.`,
    });

    const masked = reports.map((r) => ({
      ...r,
      profile: maskProfileForEmployer(r.profile, r.sessionId || r.id),
    }));

    return NextResponse.json(masked);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro ao listar relatórios." },
      { status: 500 }
    );
  }
}
