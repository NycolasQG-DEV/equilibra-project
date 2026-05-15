import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PlanType, PLAN_LIMITS, PLAN_PRICES } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    const userId = searchParams.get("userId");
    const plan = searchParams.get("plan") as PlanType;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId obrigatório." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "MP não configurado." }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: Number(paymentId) });

    const paid = result.status === "approved";

    // Se pago, ativar plano automaticamente
    if (paid && userId && plan) {
      const { data: user } = await supabaseAdmin
        .from("users").select("plan").eq("id", userId).single();

      if (user && (!user.plan || user.plan === "none")) {
        const limit = PLAN_LIMITS[plan] || 10;
        const price = PLAN_PRICES[plan] || 0;
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId, plan, status: "active", price_brl: price,
          payment_method: `PIX — Mercado Pago (#${paymentId})`,
          card_brand: "pix", card_last4: "PIX",
          started_at: now.toISOString(), expires_at: expiresAt.toISOString(),
        });

        await supabaseAdmin.from("users")
          .update({ plan, max_colaboradores: limit, role: "admin" })
          .eq("id", userId);
      }
    }

    return NextResponse.json({ status: result.status, paid });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro." }, { status: 500 });
  }
}
