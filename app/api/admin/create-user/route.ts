import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/auth/password";
import { User } from "@/types/database";
import crypto from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 255;

function sanitize(value: string, maxLen = MAX_FIELD_LENGTH): string {
  return String(value).trim().slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { name, email, password, adminId, cargo, setor, observacao } = body;

    // Auth: Verificar que o chamador é o admin
    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    if (!name || !email || !password || !adminId) {
      return NextResponse.json(
        { error: "Campos obrigatórios: name, email, password, adminId" },
        { status: 400 }
      );
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanCargo = sanitize(cargo || "");
    const cleanSetor = sanitize(setor || "");
    const cleanObs = sanitize(observacao || "", 1000);

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: "Formato de e-mail inválido." }, { status: 400 });
    }

    if (cleanName.length < 2) {
      return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    // Verificar se admin existe e tem plano
    const admin = await queryOne<User>(
      "SELECT id, role, plan, max_colaboradores FROM users WHERE id = $1",
      [adminId]
    );

    if (!admin || admin.role !== "admin") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem criar colaboradores." },
        { status: 403 }
      );
    }

    if (!admin.plan || admin.plan === "none") {
      return NextResponse.json(
        { error: "Você precisa ter um plano ativo para criar colaboradores." },
        { status: 403 }
      );
    }

    // Contar colaboradores atuais deste admin
    const countRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE admin_id = $1 AND role = 'default'",
      [adminId]
    );

    const currentCount = parseInt(countRow?.count || "0", 10);

    if (currentCount >= admin.max_colaboradores && admin.max_colaboradores < 9999) {
      return NextResponse.json({
        error: `Limite atingido! Seu plano permite até ${admin.max_colaboradores} colaboradores. Atual: ${currentCount}.`,
      }, { status: 403 });
    }

    // Verificar se o e-mail já existe
    const existingUser = await queryOne<User>("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (existingUser) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado no sistema." }, { status: 409 });
    }

    // Gerar hash de senha e salvar no banco SQL
    const passwordHash = await hashPassword(password);
    const newUserId = crypto.randomUUID();

    await execute(
      `INSERT INTO users (id, name, email, password_hash, role, plan, max_colaboradores, admin_id, cargo, setor, observacao, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'default', 'none', 0, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [newUserId, cleanName, cleanEmail, passwordHash, adminId, cleanCargo, cleanSetor, cleanObs]
    );

    // Atribuir automaticamente as pesquisas ativas do admin para o novo colaborador
    const activeSurveys = await query<{ id: string }>(
      "SELECT id FROM surveys WHERE admin_id = $1 AND is_active = true",
      [adminId]
    );

    for (const survey of activeSurveys) {
      const assignmentId = crypto.randomUUID();
      await execute(
        `INSERT INTO survey_assignments (id, survey_id, user_id, admin_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE id=id`,
        [assignmentId, survey.id, newUserId, adminId]
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: newUserId, name: cleanName, email: cleanEmail, role: "default", cargo: cleanCargo, setor: cleanSetor },
      remaining: Math.max(0, admin.max_colaboradores - currentCount - 1),
    });
  } catch (err: any) {
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ error: "Erro interno do servidor ao criar colaborador." }, { status: 500 });
  }
}
