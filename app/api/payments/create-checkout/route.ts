import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { initDatabase, queryOne } from "@/lib/db";
import { isAuthError, verifyAuth } from "@/lib/auth-guard";
import { PLAN_PRICES, PlanType, User } from "@/types/database";
import crypto from "crypto";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];

export async function POST(request: NextRequest) {
  try {
    const { userId, plan } = await request.json();
    if (!userId || !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;
    await initDatabase();

    const user = await queryOne<User>(
      "SELECT id, role, plan, email FROM users WHERE id = $1",
      [userId],
    );
    if (!user || user.role !== "admin" || (user.plan && user.plan !== "none")) {
      return NextResponse.json({ error: "Compra indisponível para esta conta." }, { status: 403 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
    }

    const amount = process.env.MERCADOPAGO_TEST_MODE === "true"
      ? 1
      : PLAN_PRICES[plan as PlanType] / 100;
    const origin = process.env.APP_URL || request.nextUrl.origin;
    const publicUrl = new URL(origin);
    const hasPublicUrl = publicUrl.protocol === "https:" && !["localhost", "127.0.0.1"].includes(publicUrl.hostname);
    const returnUrl = new URL("/planos", origin).toString();
    const reference = `${userId}:${plan}:${Date.now()}:${crypto.randomUUID()}`;
    const preference = new Preference(new MercadoPagoConfig({ accessToken }));
    const result = await preference.create({
      body: {
        items: [{ id: plan, title: `Equilibra - Plano ${plan}`, quantity: 1, unit_price: amount, currency_id: "BRL" }],
        external_reference: reference,
        ...(hasPublicUrl ? {
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          notification_url: new URL("/api/payments/webhook", origin).toString(),
        } : {}),
      },
    });

    const checkoutUrl = result.init_point;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Mercado Pago não retornou o link de pagamento." }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl, reference, openInNewTab: !hasPublicUrl });
  } catch (error) {
    console.error("Erro ao criar checkout Mercado Pago:", error);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento no Mercado Pago." }, { status: 502 });
  }
}
