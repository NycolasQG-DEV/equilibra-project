import { NextRequest, NextResponse } from "next/server";
import { getSession, logAuditAccess, maskProfileForEmployer } from "@/lib/ai/storage-mysql";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
    }

    await logAuditAccess({
      action: "ADMIN_VIEW_SESSION_DETAIL",
      targetId: session.id,
      performedBy: "GESTOR_SESMT_CIPA",
      sector: session.profile?.sector,
      legalBasis: "NR-01 Item 1.5.7.3.2 (Inventário de Riscos)",
      details: `Visualização individual de sessão detalhada (ID: ${session.id}).`,
    });

    return NextResponse.json({
      ...session,
      profile: maskProfileForEmployer(session.profile, session.id),
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao carregar sessão." }, { status: 500 });
  }
}
