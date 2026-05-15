import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_LIMITS, PLAN_PRICES } from "@/types/database";

/**
 * Confirmação manual de pagamento PIX.
 * Como não usamos provedor terceiro, o admin confirma que pagou
 * e o sistema ativa o plano.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, txId } = body;

    if (!userId || !plan) {
      return NextResponse.json({ error: "userId e plan são obrigatórios." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    // Verify user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, plan")
      .eq("id", userId)
      .single();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    if (user.plan && user.plan !== "none") {
      return NextResponse.json({ error: "Plano já ativo." }, { status: 400 });
    }

    const limit = PLAN_LIMITS[plan as PlanType] || 10;
    const price = PLAN_PRICES[plan as PlanType] || 0;

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create subscription
    await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: "active",
      price_brl: price,
      payment_method: `PIX — ${txId || "manual"}`,
      card_brand: "pix",
      card_last4: "PIX",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // Activate plan
    await supabaseAdmin
      .from("users")
      .update({ plan, max_colaboradores: limit, role: "admin" })
      .eq("id", userId);

    return NextResponse.json({ success: true, plan, limit });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno." }, { status: 500 });
  }
}
