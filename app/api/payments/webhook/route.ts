import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { PlanType, PLAN_LIMITS, PLAN_PRICES, User } from "@/types/database";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let paymentId = searchParams.get("data.id") || searchParams.get("id");

    if (!paymentId) {
      try {
        const body = await request.json();
        paymentId = body?.data?.id || body?.id;
      } catch {
        // Sem body JSON
      }
    }

    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: Number(paymentId) });

    if (result.status === "approved" && result.external_reference) {
      const parts = result.external_reference.split(":");
      if (parts.length === 2) {
        const [userId, plan] = parts as [string, PlanType];
        const user = await queryOne<User>("SELECT id, plan FROM users WHERE id = $1", [userId]);

        if (user && (!user.plan || user.plan === "none")) {
          const limit = PLAN_LIMITS[plan] || 10;
          const price = PLAN_PRICES[plan] || 0;
          const now = new Date();
          const expiresAt = new Date(now);
          expiresAt.setDate(expiresAt.getDate() + 30);
          const subId = crypto.randomUUID();

          await execute(
            `INSERT INTO subscriptions (id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at, created_at, updated_at)
             VALUES ($1, $2, $3, 'active', $4, $5, 'pix', 'PIX', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [subId, userId, plan, price, `PIX — Webhook Mercado Pago (#${paymentId})`, now.toISOString(), expiresAt.toISOString()]
          );

          await execute(
            "UPDATE users SET plan = $1, max_colaboradores = $2, role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $3",
            [plan, limit, userId]
          );

          console.log(`🎉 Webhook Mercado Pago: Plano ${plan} ativado com sucesso para ${userId}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro no webhook Mercado Pago:", err);
    return NextResponse.json({ error: "Erro interno no webhook." }, { status: 500 });
  }
}
