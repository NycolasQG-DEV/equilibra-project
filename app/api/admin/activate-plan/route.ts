import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { PlanType, PLAN_LIMITS, PLAN_PRICES } from "@/types/database";

const VALID_PLANS: PlanType[] = ["starter", "professional", "enterprise"];

function detectBrand(num: string): string {
  if (num.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "mastercard";
  if (/^3[47]/.test(num)) return "amex";
  if (num.startsWith("6")) return "elo";
  return "card";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, cardLast4, cardBrand } = body;

    // ── Auth: Verificar que o chamador é realmente o userId ──
    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    // ── Validar plano ──
    if (!userId || !plan) {
      return NextResponse.json({ error: "userId e plan são obrigatórios." }, { status: 400 });
    }

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    // ── Verificar usuário existe ──
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, role, plan")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Só admins podem ter planos
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem assinar planos." }, { status: 403 });
    }

    // Verificar se já tem plano ativo
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

    // ── Criar registro de assinatura (via service_role — seguro) ──
    const { error: subError } = await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: "active",
      price_brl: price,
      payment_method: `Cartão •••• ${last4}`,
      card_brand: brand,
      card_last4: last4,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (subError) {
      return NextResponse.json({ error: "Erro ao criar assinatura: " + subError.message }, { status: 500 });
    }

    // ── Atualizar plano do usuário (via service_role — seguro) ──
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ plan, max_colaboradores: limit, role: "admin" })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: "Erro ao atualizar plano: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan, limit });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
