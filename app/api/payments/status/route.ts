import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import crypto from "crypto";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_LIMITS, PLAN_PRICES, User } from "@/types/database";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) return auth;
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    let paymentId = searchParams.get("paymentId") || "";
    const reference = searchParams.get("reference") || "";

    if (!paymentId && !reference) {
      return NextResponse.json({ error: "Identificação do pagamento é obrigatória." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    if (reference && !paymentId) {
      const [ownerId, plan, timestamp, nonce] = reference.split(":");
      if (ownerId !== auth.userId || !VALID_PLANS.includes(plan as PlanType) ||
          !/^\d{13}$/.test(timestamp || "") || !/^[0-9a-f-]{36}$/.test(nonce || "") ||
          Date.now() - Number(timestamp) > 24 * 60 * 60 * 1000 || Number(timestamp) > Date.now()) {
        return NextResponse.json({ error: "Referência de pagamento inválida." }, { status: 400 });
      }
      const found = await payment.search({ options: { external_reference: reference, limit: 10 } });
      paymentId = String(found.results?.find((item) => item.external_reference === reference && item.id)?.id || "");
      if (!paymentId) return NextResponse.json({ status: "pending", paid: false, plan });
    }
    if (!/^\d+$/.test(paymentId)) {
      return NextResponse.json({ error: "paymentId inválido." }, { status: 400 });
    }
    const result = await payment.get({ id: Number(paymentId) });

    const [ownerId, plan] = (result.external_reference || "").split(":");
    if (ownerId !== auth.userId || !VALID_PLANS.includes(plan as PlanType)) {
      return NextResponse.json({ error: "Pagamento indisponível." }, { status: 403 });
    }
    if (reference && result.external_reference !== reference) {
      return NextResponse.json({ error: "Pagamento indisponível." }, { status: 403 });
    }

    const user = await queryOne<{ plan: PlanType }>("SELECT plan FROM users WHERE id = $1", [
      auth.userId,
    ]);

    // Se aprovado no Mercado Pago e plano ainda não ativado localmente
    if (result.status === "approved" && (!user?.plan || user.plan === "none")) {
      const selectedPlan = plan as PlanType;
      const limit = PLAN_LIMITS[selectedPlan] || 10;
      const price = PLAN_PRICES[selectedPlan] || 0;
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30);
      const subId = crypto.randomUUID();

      await execute(
        `INSERT INTO subscriptions (id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, $5, 'pix', 'PIX', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          subId,
          auth.userId,
          selectedPlan,
          price,
          `PIX Mercado Pago (#${paymentId})`,
          now.toISOString(),
          expiresAt.toISOString(),
        ],
      );

      await execute(
        "UPDATE users SET plan = $1, max_colaboradores = $2, role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $3",
        [selectedPlan, limit, auth.userId],
      );
    }

    return NextResponse.json({
      status: result.status || "pending",
      paid: result.status === "approved",
      plan,
    });
  } catch (err: any) {
    console.error("Erro na verificação de status:", err);
    return NextResponse.json(
      { error: "Não foi possível verificar o status do pagamento." },
      { status: 502 },
    );
  }
}
