import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, initDatabase } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const { id } = await params;
    const body = await request.json();
    const { adminId, is_active } = body;

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    await execute(
      "UPDATE surveys SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND admin_id = $3",
      [Boolean(is_active), id, adminId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao atualizar status da pesquisa." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const { id } = await params;
    const body = await request.json();
    const { adminId } = body;

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    await execute(
      "DELETE FROM surveys WHERE id = $1 AND admin_id = $2",
      [id, adminId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao remover pesquisa." }, { status: 500 });
  }
}
