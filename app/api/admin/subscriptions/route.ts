import { NextRequest, NextResponse } from "next/server";
import { query, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";
import { Subscription } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const auth = await verifyAuth(request, userId);
    if (isAuthError(auth)) return auth;

    const subscriptions = await query<Subscription>(
      "SELECT id, user_id, plan, status, price_brl, payment_method, card_brand, card_last4, started_at, expires_at, cancelled_at, created_at, updated_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return NextResponse.json({ subscriptions });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao buscar assinaturas." }, { status: 500 });
  }
}
