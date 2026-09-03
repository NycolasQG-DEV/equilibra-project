import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;

    return NextResponse.json({
      user: auth.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao obter sessão atual." },
      { status: 500 }
    );
  }
}
