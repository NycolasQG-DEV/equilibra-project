import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 255;

function sanitize(value: string, maxLen = MAX_FIELD_LENGTH): string {
  return String(value).trim().slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, adminId, cargo, setor, observacao } = body;

    // ── Auth: Verificar que o chamador é realmente o admin ──
    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    // ── Validação de entrada ──
    if (!name || !email || !password || !adminId) {
      return NextResponse.json({ error: "Campos obrigatórios: name, email, password, adminId" }, { status: 400 });
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanCargo = sanitize(cargo || "");
    const cleanSetor = sanitize(setor || "");
    const cleanObs = sanitize(observacao || "", 1000);

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: "Formato de e-mail inválido." }, { status: 400 });
    }

    if (cleanName.length < 2) {
      return NextResponse.json({ error: "O nome deve ter pelo menos 2 caracteres." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: "A senha não pode exceder 128 caracteres." }, { status: 400 });
    }

    // ── Verificar se o admin existe e tem plano ──
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from("users")
      .select("id, role, plan, max_colaboradores")
      .eq("id", adminId)
      .single();

    if (adminErr || !admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado. Apenas administradores podem criar colaboradores." }, { status: 403 });
    }

    if (admin.plan === "none") {
      return NextResponse.json({ error: "Você precisa ter um plano ativo para criar colaboradores." }, { status: 403 });
    }

    // ── Contar colaboradores atuais deste admin ──
    const { count } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .eq("role", "default");

    const currentCount = count ?? 0;

    if (currentCount >= admin.max_colaboradores) {
      return NextResponse.json({
        error: `Limite atingido! Seu plano permite até ${admin.max_colaboradores} colaboradores. Atual: ${currentCount}.`,
      }, { status: 403 });
    }

    // ── Criar usuário no auth ──
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { name: cleanName },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
    }

    // ── Criar perfil na tabela users ──
    const { error: profileErr } = await supabaseAdmin.from("users").upsert([{
      id: authData.user.id,
      name: cleanName,
      email: cleanEmail,
      role: "default",
      plan: "none",
      max_colaboradores: 0,
      admin_id: adminId,
      cargo: cleanCargo,
      setor: cleanSetor,
      observacao: cleanObs,
    }], { onConflict: "id" });

    if (profileErr) {
      return NextResponse.json({ error: "Usuário auth criado, mas erro ao salvar perfil: " + profileErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, name: cleanName, email: cleanEmail, role: "default" },
      remaining: admin.max_colaboradores - currentCount - 1,
    });
  } catch (err) {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
