import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, userId } = body;

    // ── Auth: Verificar que o chamador é realmente o admin ──
    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    if (!adminId || !userId) {
      return NextResponse.json({ error: "adminId e userId são obrigatórios." }, { status: 400 });
    }

    // Verificar se o chamador é admin
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", adminId)
      .single();

    if (adminErr || !admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Verificar se o colaborador pertence a este admin
    const { data: target, error: targetErr } = await supabaseAdmin
      .from("users")
      .select("id, admin_id, role")
      .eq("id", userId)
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    if (target.admin_id !== adminId) {
      return NextResponse.json({ error: "Este colaborador não pertence a você." }, { status: 403 });
    }

    // Impedir remoção de outro admin
    if (target.role === "admin") {
      return NextResponse.json({ error: "Não é possível remover um administrador." }, { status: 403 });
    }

    // Remover perfil da tabela users
    const { error: deleteProfileErr } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteProfileErr) {
      return NextResponse.json({ error: "Erro ao remover perfil: " + deleteProfileErr.message }, { status: 500 });
    }

    // Remover usuário do auth
    const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthErr) {
      return NextResponse.json({
        error: "Perfil removido, mas erro ao remover auth: " + deleteAuthErr.message,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
