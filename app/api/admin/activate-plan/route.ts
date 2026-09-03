import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_LIMITS, PLAN_PRICES, User } from "@/types/database";
import crypto from "crypto";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { userId, plan, cardLast4, cardBrand } = body;

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    if (!userId || !plan) {
      return NextResponse.json({ error: "userId e plan são obrigatórios." }, { status: 400 });
    }

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    const user = await queryOne<User>("SELECT id, role, plan FROM users WHERE id = $1", [userId]);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem assinar planos." }, { status: 403 });
    }

    if (user.plan && user.plan !== "none") {
      return NextResponse.json({ error: "Você já possui um plano ativo. Cancele-o antes de assinar outro." }, { status: 400 });
    }

    const limit = PLAN_LIMITS[plan as PlanType];
    const price = PLAN_PRICES[plan as PlanType];
    const last4 = String(cardLast4 || "0000").slice(-4);
    const brand = cardBrand || "card";

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);
    const subId = crypto.randomUUID();

    await execute(
      `INSERT INTO subscriptions (id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [subId, userId, plan, price, `Cartão •••• ${last4}`, brand, last4, now.toISOString(), expiresAt.toISOString()]
    );

    await execute(
      `UPDATE users SET plan = $1, max_colaboradores = $2, role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [plan, limit, userId]
    );

    return NextResponse.json({ success: true, plan, limit });
  } catch (err: any) {
    console.error("Erro ao ativar plano:", err);
    return NextResponse.json({ error: "Erro interno do servidor ao ativar plano." }, { status: 500 });
  }
}
