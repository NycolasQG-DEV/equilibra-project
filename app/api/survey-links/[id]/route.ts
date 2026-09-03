import { NextRequest, NextResponse } from "next/server";
import { getSurveyLink, deleteSurveyLink } from "@/lib/ai/storage-mysql";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = await getSurveyLink(id);
    if (!link) {
      return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
    }
    return NextResponse.json(link);
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao buscar link." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSurveyLink(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao excluir link." }, { status: 500 });
  }
}
