import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_LIMITS } from "@/types/database";
import { generatePixBrCode } from "@/lib/pix";
import QRCode from "qrcode";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];
const TEST_PRICE = 0.50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan } = body;

    if (!userId || !plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "userId e plan válidos são obrigatórios." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    const { data: user } = await supabaseAdmin
      .from("users").select("id, role, plan, name, email").eq("id", userId).single();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (user.plan && user.plan !== "none") {
      return NextResponse.json({ error: "Você já possui um plano ativo." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (accessToken) {
      // ── Mercado Pago (verificação automática) ──
      try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const result = await payment.create({
          body: {
            transaction_amount: TEST_PRICE,
            description: `Equilibra - Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            payment_method_id: "pix",
            payer: {
              email: user.email || "test@equilibra.com",
              first_name: user.name?.split(" ")[0] || "Usuario",
              last_name: user.name?.split(" ").slice(1).join(" ") || "Equilibra",
            },
          },
        });

        if (!result.id) {
          throw new Error("Falha ao criar pagamento");
        }

        const pixData = result.point_of_interaction?.transaction_data;

        return NextResponse.json({
          success: true,
          provider: "mercadopago",
          paymentId: String(result.id),
          brCode: pixData?.qr_code || "",
          qrCodeImage: pixData?.qr_code_base64
            ? `data:image/png;base64,${pixData.qr_code_base64}`
            : "",
          amount: TEST_PRICE,
          plan,
          autoVerify: true,
        });
      } catch (err: any) {
        console.error("MP Error:", err.message);
      }
    }

    // ── Fallback: PIX local ──
    const pixKey = process.env.PIX_KEY;
    if (!pixKey) {
      return NextResponse.json({ error: "Configure MERCADOPAGO_ACCESS_TOKEN ou PIX_KEY no .env" }, { status: 500 });
    }

    const txId = `EQ${Date.now().toString(36).toUpperCase()}`;
    const brCode = generatePixBrCode({
      pixKey, merchantName: process.env.PIX_NAME || "EQUILIBRA",
      merchantCity: process.env.PIX_CITY || "SAO PAULO", amount: TEST_PRICE, txId,
    });
    const qrCodeImage = await QRCode.toDataURL(brCode, {
      width: 400, margin: 2, color: { dark: "#260054", light: "#FFFFFF" },
    });

    return NextResponse.json({
      success: true, provider: "local", paymentId: txId,
      brCode, qrCodeImage, amount: TEST_PRICE, plan, autoVerify: false,
    });
  } catch (err: any) {
    console.error("PIX Error:", err);
    return NextResponse.json({ error: err?.message || "Erro interno." }, { status: 500 });
  }
}
