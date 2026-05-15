import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuth, isAuthError } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { adminId, is_active } = body;

    if (!adminId) {
      return NextResponse.json({ error: "adminId é obrigatório." }, { status: 400 });
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof is_active === "boolean") updates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from("surveys")
      .update(updates)
      .eq("id", id)
      .eq("admin_id", adminId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, survey: data });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { adminId } = body;

    if (!adminId) {
      return NextResponse.json({ error: "adminId é obrigatório." }, { status: 400 });
    }

    const auth = await verifyAuth(request, adminId);
    if (isAuthError(auth)) return auth;

    const { error } = await supabaseAdmin
      .from("surveys")
      .delete()
      .eq("id", id)
      .eq("admin_id", adminId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
