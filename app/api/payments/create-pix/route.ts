import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import QRCode from "qrcode";
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
      return NextResponse.json(
        { error: "userId e plan válidos são obrigatórios." },
        { status: 400 },
      );
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    const user = await queryOne<User>(
      "SELECT id, role, plan, name, email FROM users WHERE id = $1",
      [userId],
    );

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (user.plan && user.plan !== "none") {
      return NextResponse.json(
        { error: "Você já possui um plano ativo." },
        { status: 400 },
      );
    }

    const testMode = process.env.MERCADOPAGO_TEST_MODE === "true";
    const selectedPlan = plan as PlanType;
    const transactionAmount = testMode
      ? 1.0
      : PLAN_PRICES[selectedPlan]
        ? PLAN_PRICES[selectedPlan] / 100
        : 1.0;

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (accessToken && !accessToken.includes("placeholder")) {
      try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const payerEmail = user.email || "contato@equilibra.com";
        const payerFirstName = user.name?.split(" ")[0] || "Administrador";
        const payerLastName = user.name?.split(" ").slice(1).join(" ") || "Equilibra";

        const result = await payment.create({
          body: {
            transaction_amount: transactionAmount,
            description: `Equilibra - Assinatura Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            payment_method_id: "pix",
            external_reference: `${userId}:${plan}`,
            payer: {
              email: payerEmail,
              first_name: payerFirstName,
              last_name: payerLastName,
            },
          },
        });

        if (result.id) {
          const paymentId = String(result.id);
          const status = result.status || "pending";
          const pixData = result.point_of_interaction?.transaction_data;
          const brCode = pixData?.qr_code || "";
          const qrCodeBase64 = pixData?.qr_code_base64;
          const qrCodeImage = qrCodeBase64
            ? `data:image/png;base64,${qrCodeBase64}`
            : brCode
              ? await QRCode.toDataURL(brCode, { margin: 2, width: 300 })
              : "";

          return NextResponse.json({
            success: true,
            paymentId,
            brCode,
            qrCodeImage,
            amount: transactionAmount,
            plan,
            status,
          });
        }
        return NextResponse.json({ error: "Mercado Pago não retornou uma cobrança PIX." }, { status: 502 });
      } catch (mpError) {
        console.error("Erro ao criar PIX no Mercado Pago:", mpError);
        return NextResponse.json({ error: "Não foi possível criar o PIX no Mercado Pago." }, { status: 502 });
      }
    }
    return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
  } catch (err: any) {
    console.error("Erro na API (create-pix):", err);
    return NextResponse.json(
      { error: err?.message || "Erro de comunicação ao gerar cobrança PIX." },
      { status: 500 },
    );
  }
}
