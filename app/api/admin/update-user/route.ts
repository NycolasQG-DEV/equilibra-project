import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

const MAX_FIELD_LENGTH = 255;

function sanitize(value: string, maxLen = MAX_FIELD_LENGTH): string {
  return String(value).trim().slice(0, maxLen);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, userId, name, cargo, setor, observacao } = body;

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
      .select("id, admin_id")
      .eq("id", userId)
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    if (target.admin_id !== adminId) {
      return NextResponse.json({ error: "Este colaborador não pertence a você." }, { status: 403 });
    }

    // Montar objeto de atualização (somente campos enviados + sanitizados)
    const updates: Record<string, string> = {};
    if (name !== undefined) {
      const cleanName = sanitize(name);
      if (cleanName.length < 2) {
        return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
      }
      updates.name = cleanName;
    }
    if (cargo !== undefined) updates.cargo = sanitize(cargo);
    if (setor !== undefined) updates.setor = sanitize(setor);
    if (observacao !== undefined) updates.observacao = sanitize(observacao, 1000);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Erro ao atualizar: " + updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
