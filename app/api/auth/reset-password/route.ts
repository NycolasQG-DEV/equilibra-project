import { NextRequest, NextResponse } from "next/server";
import { queryOne, initDatabase } from "@/lib/db";
import { User } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "E-mail é obrigatório." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await queryOne<User>(
      "SELECT id, email FROM users WHERE email = $1",
      [cleanEmail]
    );

    // Por segurança, retorna mensagem de sucesso mesmo se o e-mail não existir (evita enumeração)
    return NextResponse.json({
      success: true,
      message: "Se o e-mail estiver cadastrado, as instruções de recuperação serão enviadas.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao processar solicitação de recuperação." },
      { status: 500 }
    );
  }
}
