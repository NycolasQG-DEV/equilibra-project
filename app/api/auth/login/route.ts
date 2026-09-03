import { NextRequest, NextResponse } from "next/server";
import { queryOne, initDatabase } from "@/lib/db";
import { comparePassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { User } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Buscar usuário e hash da senha
    const user = await queryOne<User & { password_hash: string }>(
      `SELECT id, name, email, password_hash, role, plan, max_colaboradores, admin_id, cargo, setor, observacao, created_at, updated_at
       FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    const { password_hash, ...userProfile } = user;

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
    });

    // Salvar token e sessão em Cookies para persistência de login
    response.cookies.set("equilibra_auth_token", token, {
      httpOnly: false, // permite sincronização suave cliente/servidor
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: "/",
    });

    response.cookies.set("equilibra_auth_user", encodeURIComponent(JSON.stringify(userProfile)), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno do servidor ao autenticar." },
      { status: 500 }
    );
  }
}
