import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  try {
    const { userId, subscriptionId } = await request.json();

    // ── Auth: Verificar que o chamador é realmente o userId ──
    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    if (!userId || !subscriptionId) {
      return NextResponse.json({ error: "userId e subscriptionId são obrigatórios." }, { status: 400 });
    }

    // Verificar admin
    const { data: admin } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Verificar que a subscription pertence ao user
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .eq("user_id", userId)
      .single();

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
    }

    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "Assinatura já cancelada." }, { status: 400 });
    }

    // Cancelar assinatura
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", subscriptionId);

    // Resetar plano do usuário
    await supabaseAdmin
      .from("users")
      .update({ plan: "none", max_colaboradores: 0 })
      .eq("id", userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
