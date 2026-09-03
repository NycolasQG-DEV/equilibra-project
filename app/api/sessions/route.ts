import { NextRequest, NextResponse } from "next/server";
import { listSessions, maskProfileForEmployer } from "@/lib/ai/storage-mysql";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector") || undefined;

    let sessions = await listSessions(sector);

    // Sigilo técnico perante o empregador (LGPD Art. 13)
    const protectedSessions = sessions.map((session) => ({
      ...session,
      profile: maskProfileForEmployer(session.profile, session.id),
    }));

    return NextResponse.json(protectedSessions);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro ao listar sessões para o gestor." },
      { status: 500 }
    );
  }
}
