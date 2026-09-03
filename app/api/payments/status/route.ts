import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { PlanType, PLAN_LIMITS, PLAN_PRICES, User } from "@/types/database";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    let userId = searchParams.get("userId");
    let plan = searchParams.get("plan") as PlanType | null;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId obrigatório." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: Number(paymentId) });

    // Recupera userId e plano do external_reference se não foram passados na URL
    if (result.external_reference && (!userId || !plan)) {
      const parts = result.external_reference.split(":");
      if (parts.length === 2) {
        if (!userId) userId = parts[0];
        if (!plan) plan = parts[1] as PlanType;
      }
    }

    const paid = result.status === "approved";

    // Se o pagamento foi aprovado, ativa automaticamente o plano no banco SQL
    if (paid && userId && plan) {
      const user = await queryOne<User>("SELECT id, plan, max_colaboradores FROM users WHERE id = $1", [userId]);

      if (user && (!user.plan || user.plan === "none")) {
        const limit = PLAN_LIMITS[plan] || 10;
        const price = PLAN_PRICES[plan] || 0;
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30);
        const subId = crypto.randomUUID();

        // 1. Registrar assinatura
        await execute(
          `INSERT INTO subscriptions (id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', $4, $5, 'pix', 'PIX', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [subId, userId, plan, price, `PIX — Mercado Pago (#${paymentId})`, now.toISOString(), expiresAt.toISOString()]
        );

        // 2. Atualizar permissões do usuário
        await execute(
          "UPDATE users SET plan = $1, max_colaboradores = $2, role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $3",
          [plan, limit, userId]
        );

        console.log(`🎉 Plano ${plan} ativado com sucesso para o usuário ${userId} via Mercado Pago (Pagamento #${paymentId})`);
      }
    }

    return NextResponse.json({
      status: result.status,
      paid,
      plan: plan || undefined,
    });
  } catch (err: any) {
    console.error("Erro na verificação de status Mercado Pago:", err);
    return NextResponse.json({ error: err?.message || "Erro na consulta de pagamento." }, { status: 500 });
  }
}
