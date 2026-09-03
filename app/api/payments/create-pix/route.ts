import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { queryOne, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_PRICES, User } from "@/types/database";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const body = await request.json();
    const { userId, plan } = body;

    if (!userId || !plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "userId e plan válidos são obrigatórios." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    const user = await queryOne<User>(
      "SELECT id, role, plan, name, email FROM users WHERE id = $1",
      [userId]
    );

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (user.plan && user.plan !== "none") {
      return NextResponse.json({ error: "Você já possui um plano ativo." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "Token de acesso do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) não configurado no arquivo .env." },
        { status: 500 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    // Preço de teste padrão R$ 0.50 ou valor real baseado na flag
    const testMode = process.env.MERCADOPAGO_TEST_MODE !== "false";
    const selectedPlan = plan as PlanType;
    const transactionAmount = testMode ? 0.50 : (PLAN_PRICES[selectedPlan] ? PLAN_PRICES[selectedPlan] / 100 : 0.50);

    const result = await payment.create({
      body: {
        transaction_amount: transactionAmount,
        description: `Equilibra - Assinatura Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        payment_method_id: "pix",
        external_reference: `${userId}:${plan}`,
        payer: {
          email: user.email || "contato@equilibra.com",
          first_name: user.name?.split(" ")[0] || "Administrador",
          last_name: user.name?.split(" ").slice(1).join(" ") || "Equilibra",
        },
      },
    });

    if (!result.id) {
      return NextResponse.json({ error: "Falha ao gerar cobrança PIX no Mercado Pago." }, { status: 502 });
    }

    const pixData = result.point_of_interaction?.transaction_data;
    const brCode = pixData?.qr_code || "";
    const qrCodeBase64 = pixData?.qr_code_base64;
    const qrCodeImage = qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : "";

    return NextResponse.json({
      success: true,
      paymentId: String(result.id),
      brCode,
      qrCodeImage,
      amount: transactionAmount,
      plan,
      status: result.status,
    });
  } catch (err: any) {
    console.error("Erro na API Mercado Pago (create-pix):", err);
    return NextResponse.json(
      { error: err?.message || "Erro de comunicação com o Mercado Pago." },
      { status: 500 }
    );
  }
}
