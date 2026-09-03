import { NextRequest, NextResponse } from "next/server";
import { getSurveyLink } from "@/lib/ai/storage-mysql";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = await getSurveyLink(id);

    if (!link) {
      return NextResponse.json(
        {
          valid: false,
          error: "Link de pesquisa inexistente ou incorreto. Solicite o link oficial ao gestor da empresa.",
        },
        { status: 404 }
      );
    }

    if (link.used === true) {
      return NextResponse.json(
        {
          valid: false,
          error: "Este link de pesquisa já foi utilizado e concluído. Cada link gerado pelo gestor é de uso único.",
        },
        { status: 403 }
      );
    }

    if (link.active === false) {
      return NextResponse.json(
        {
          valid: false,
          error: "Este link de pesquisa foi pausado ou desativado pelo administrador do sistema.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      link: {
        id: link.id,
        title: link.title,
        sector: link.sector,
        role: link.role || null,
        adminName: link.adminName,
        createdAt: link.createdAt,
        active: link.active,
        used: Boolean(link.used),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, error: "Erro ao verificar link no servidor." },
      { status: 500 }
    );
  }
}
