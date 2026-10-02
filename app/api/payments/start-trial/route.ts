import { NextRequest, NextResponse } from "next/server";
import { initDatabase, execute, queryOne } from "@/lib/db";
import { isAuthError, verifyAuth } from "@/lib/auth-guard";
import { User } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "Usuário não fornecido." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;
    await initDatabase();

    const user = await queryOne<User>(
      "SELECT id, role, plan, email FROM users WHERE id = $1",
      [userId]
    );

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Conta não autorizada." }, { status: 403 });
    }

    if (user.plan && user.plan !== "none") {
      return NextResponse.json({ error: "Sua conta já possui um plano ativado." }, { status: 400 });
    }

    // Ativa o plano de teste grátis (Starter com degustação)
    await execute(
      "UPDATE users SET plan = $1, max_colaboradores = $2 WHERE id = $3",
      ["starter", 10, userId]
    );

    // Registra a assinatura de degustação
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await execute(
      `INSERT INTO subscriptions (id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        userId,
        "starter",
        "active",
        0,
        "Degustação Gratuita (7 Dias)",
        "FREE",
        "7DAYS",
        now.toISOString(),
        expiresAt.toISOString(),
      ]
    );

    return NextResponse.json({ success: true, message: "Teste grátis de 7 dias ativado com sucesso!" });
  } catch (error) {
    console.error("Erro ao ativar teste grátis:", error);
    return NextResponse.json({ error: "Não foi possível ativar o teste grátis." }, { status: 500 });
  }
}
