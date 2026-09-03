import { NextRequest, NextResponse } from "next/server";
import { listAuditLogs } from "@/lib/ai/storage-mysql";

export async function GET(request: NextRequest) {
  try {
    const logs = await listAuditLogs();
    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao carregar logs de auditoria." }, { status: 500 });
  }
}
