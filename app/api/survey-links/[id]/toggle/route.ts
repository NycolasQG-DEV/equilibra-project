import { NextRequest, NextResponse } from "next/server";
import { toggleSurveyLinkStatus, logAuditAccess } from "@/lib/ai/storage-mysql";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await toggleSurveyLinkStatus(id);
    if (!updated) {
      return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
    }

    await logAuditAccess({
      action: updated.active ? "SURVEY_LINK_ACTIVATED" : "SURVEY_LINK_PAUSED",
      targetId: updated.id,
      performedBy: "ADMIN_SST",
      details: `Status do link "${updated.title}" alterado para ${updated.active ? "ATIVO" : "PAUSADO"}.`,
    });

    return NextResponse.json({ success: true, link: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao alterar status do link." }, { status: 500 });
  }
}
