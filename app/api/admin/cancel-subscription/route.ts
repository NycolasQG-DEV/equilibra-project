import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { Subscription, User } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const { userId, subscriptionId } = await request.json();

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    if (!userId || !subscriptionId) {
      return NextResponse.json({ error: "userId e subscriptionId são obrigatórios." }, { status: 400 });
    }

    const admin = await queryOne<User>("SELECT id, role FROM users WHERE id = $1", [userId]);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const sub = await queryOne<Subscription>(
      "SELECT id, user_id, status FROM subscriptions WHERE id = $1 AND user_id = $2",
      [subscriptionId, userId]
    );

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
    }

    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "Assinatura já cancelada." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await execute(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = $1, updated_at = $2 WHERE id = $3",
      [now, now, subscriptionId]
    );

    await execute(
      "UPDATE users SET plan = 'none', max_colaboradores = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao cancelar assinatura:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
