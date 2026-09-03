import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { User, UserRole, PlanType } from "@/types/database";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    const cleanName = String(name).trim().slice(0, 255);
    const cleanEmail = String(email).trim().toLowerCase().slice(0, 255);

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Formato de e-mail inválido." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A senha deve conter no mínimo 8 caracteres." },
        { status: 400 }
      );
    }

    // Verificar se e-mail já existe
    const existing = await queryOne<User>(
      "SELECT id FROM users WHERE email = $1",
      [cleanEmail]
    );

    if (existing) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado." },
        { status: 409 }
      );
    }

    // Gerar hash seguro de senha e UUID
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const role: UserRole = "admin";
    const plan: PlanType = "none";
    const maxColaboradores = 0;

    await execute(
      `INSERT INTO users (id, name, email, password_hash, role, plan, max_colaboradores, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, cleanName, cleanEmail, passwordHash, role, plan, maxColaboradores]
    );

    const newUser: User = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
      plan,
      max_colaboradores: maxColaboradores,
      created_at: new Date().toISOString(),
    };

    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      plan: newUser.plan,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: newUser,
    });

    // Salvar token e sessão em Cookies para persistência de login
    response.cookies.set("equilibra_auth_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: "/",
    });

    response.cookies.set("equilibra_auth_user", encodeURIComponent(JSON.stringify(newUser)), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Erro no cadastro:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno do servidor ao criar conta." },
      { status: 500 }
    );
  }
}
