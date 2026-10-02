import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json(
    { error: "Use o link da campanha para a conversa guiada." },
    { status: 410 },
  );
}
export const POST = GET;
