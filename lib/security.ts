import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { verifyAuth, isAuthError } from "./auth-guard";
import { initDatabase, supabaseAdmin } from "./db";
import { getSession, SessionData } from "./ai/storage-mysql";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
    },
    {
      status: e instanceof HttpError ? e.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function sameOrigin(r: NextRequest) {
  const origin = r.headers.get("origin");
  if (
    !origin ||
    origin !==
      (process.env.APP_URL
        ? new URL(process.env.APP_URL).origin
        : r.nextUrl.origin)
  )
    throw new HttpError(403, "Origem não autorizada.");
}
export async function body(r: NextRequest) {
  sameOrigin(r);
  if (Number(r.headers.get("content-length") || 0) > 16384)
    throw new HttpError(413, "Conteúdo muito longo.");
  const reader = r.body?.getReader();
  if (!reader) throw new HttpError(400, "Dados inválidos.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new HttpError(413, "Conteúdo muito longo.");
    }
    chunks.push(value);
  }
  const s = Buffer.concat(chunks).toString("utf8");
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw 0;
    return v;
  } catch {
    throw new HttpError(400, "Dados inválidos.");
  }
}
export async function admin(r: NextRequest) {
  await initDatabase();
  const a = await verifyAuth(r);
  if (isAuthError(a))
    throw new HttpError(a.status, "Entre na sua conta para continuar.");
  if (a.role !== "admin" && a.role !== "dev")
    throw new HttpError(403, "Acesso restrito ao gestor.");
  return a;
}
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export const cookieName = (id: string) => "eq_part_" + id;
export function ownsSession(r: NextRequest, s: SessionData) {
  const token = r.cookies.get(cookieName(s.id))?.value,
    hash = s.lgpdConsent?.tokenHash;
  if (!token || typeof hash !== "string" || hash.length !== 64) return false;
  return timingSafeEqual(Buffer.from(digest(token)), Buffer.from(hash));
}
export async function participant(r: NextRequest, id: string) {
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(id))
    throw new HttpError(404, "Participação indisponível.");
  const s = await getSession(id);
  if (!s || !ownsSession(r, s))
    throw new HttpError(
      403,
      "Esta participação pertence ao navegador que a iniciou.",
    );
  return s;
}
export function publicSession(s: SessionData) {
  return {
    id: s.id,
    status: s.status,
    history: s.history,
    currentStepData: s.currentStepData,
    reportId: s.reportId,
  };
}
export async function rate(key: string, limit = 30, seconds = 60) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const id = digest(key + ":" + bucket);
  const expiresAt = new Date(Date.now() + seconds * 2000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: current, error: readError } = await supabaseAdmin.from("request_limits")
      .select("hits").eq("id", id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) {
      const { error: insertError } = await supabaseAdmin.from("request_limits")
        .insert({ id, hits: 1, expires_at: expiresAt });
      if (!insertError) return;
      if (insertError.code === "23505") continue;
      throw new Error(insertError.message);
    }
    if (current.hits >= limit)
      throw new HttpError(429, "Muitas solicitações. Aguarde antes de tentar novamente.");
    const { data: updated, error: updateError } = await supabaseAdmin.from("request_limits")
      .update({ hits: current.hits + 1 }).eq("id", id).eq("hits", current.hits).select("id");
    if (updateError) throw new Error(updateError.message);
    if (updated?.length) return;
  }
  throw new HttpError(429, "Muitas solicitações. Aguarde antes de tentar novamente.");
}
export function textField(v: unknown, min: number, max: number, label: string) {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    throw new HttpError(
      400,
      label + " deve ter entre " + min + " e " + max + " caracteres.",
    );
  return v.trim();
}
