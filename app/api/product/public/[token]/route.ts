import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { body, digest, failure, HttpError, json, rate } from "@/lib/security";
import { supabaseAdmin } from "@/lib/db";
import { Question, sentiment } from "@/lib/product/surveys";

type Invite = { token_hash: string; run_id: string; used_at: string | null };
type Run = { title: string; sector: string; questions: Question[]; closed_at: string | null };

function validToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new HttpError(404, "Convite indisponível.");
  return digest(token);
}

async function loadRunOrInvite(tokenRaw: string): Promise<{ run: Run; runId: string; isDirectRun: boolean; inviteHash?: string }> {
  // 1. Verificar se é UUID direto de Run (Link Único da Campanha)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenRaw);
  if (isUuid) {
    const { data: run, error: runError } = await supabaseAdmin.from("product_runs")
      .select("id,title,sector,questions,closed_at").eq("id", tokenRaw).maybeSingle();
    if (runError) throw new Error(runError.message);
    if (!run) throw new HttpError(404, "Pesquisa não encontrada ou link expirado.");
    if (run.closed_at) throw new HttpError(404, "Esta pesquisa já foi encerrada pela gestão.");
    return { run: run as Run, runId: run.id, isDirectRun: true };
  }

  // 2. Caso contrário, buscar por token hash individual
  const hash = digest(tokenRaw);
  const { data: invite, error: inviteError } = await supabaseAdmin.from("product_invites")
    .select("token_hash,run_id,used_at").eq("token_hash", hash).maybeSingle();
  if (inviteError) throw new Error(inviteError.message);
  if (!invite || invite.used_at) throw new HttpError(404, "Convite indisponível ou já utilizado.");
  const { data: run, error: runError } = await supabaseAdmin.from("product_runs")
    .select("id,title,sector,questions,closed_at").eq("id", invite.run_id).maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!run || run.closed_at) throw new HttpError(404, "Pesquisa encerrada.");
  return { run: run as Run, runId: invite.run_id, isDirectRun: false, inviteHash: hash };
}

export async function GET(_r: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const tokenRaw = (await context.params).token;
    const { run } = await loadRunOrInvite(tokenRaw);
    return json({ title: run.title, sector: run.sector, questions: run.questions });
  } catch (e) { return failure(e); }
}

export async function POST(r: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const tokenRaw = (await context.params).token;
    const input = await body(r);
    if (input.consent !== true) throw new HttpError(400, "Confirme a leitura do aviso de participação.");
    await rate(`answer:${tokenRaw.slice(0, 32)}`, 10, 3600);
    const { run, runId, isDirectRun, inviteHash } = await loadRunOrInvite(tokenRaw);

    const questions = run.questions;
    const submitted = input.answers;
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted))
      throw new HttpError(400, "Respostas inválidas.");
    const keys = Object.keys(submitted);
    if (keys.some((key) => !questions.some((q) => q.id === key)))
      throw new HttpError(400, "Resposta fora da pesquisa.");
    const answers: Record<string, number | string | null> = {};
    const sentiments: Record<string, string> = {};
    for (const q of questions) {
      const value = (submitted as Record<string, unknown>)[q.id];
      if (q.type === "likert") {
        if (value !== null && value !== undefined && value !== "" && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5))
          throw new HttpError(400, "Resposta de escala inválida.");
        answers[q.id] = value == null || value === "" ? null : Number(value);
      } else {
        if (value !== null && value !== undefined && typeof value !== "string")
          throw new HttpError(400, "Resposta aberta inválida.");
        const text = typeof value === "string" ? value.trim() : "";
        if (text.length > 1200) throw new HttpError(400, "Resposta aberta muito longa.");
        answers[q.id] = text ? "respondido" : null;
        if (text) sentiments[q.id] = sentiment(text);
      }
    }

    const claimTime = new Date().toISOString();
    if (!isDirectRun && inviteHash) {
      const { data: claimed, error: claimError } = await supabaseAdmin.from("product_invites")
        .update({ used_at: claimTime }).eq("token_hash", inviteHash).is("used_at", null).select("token_hash");
      if (claimError) throw new Error(claimError.message);
      if (!claimed?.length) throw new HttpError(409, "Convite já utilizado.");
    }

    try {
      const { data: currentRun, error: currentError } = await supabaseAdmin.from("product_runs")
        .select("closed_at").eq("id", runId).single();
      if (currentError) throw new Error(currentError.message);
      if (currentRun.closed_at) throw new HttpError(409, "Pesquisa encerrada.");
      const { error: answerError } = await supabaseAdmin.from("product_answers").insert({
        id: randomUUID(), run_id: runId, answers, sentiment: sentiments,
      });
      if (answerError) throw new Error(answerError.message);
    } catch (error) {
      if (!isDirectRun && inviteHash) {
        await supabaseAdmin.from("product_invites").update({ used_at: null })
          .eq("token_hash", inviteHash).eq("used_at", claimTime);
      }
      throw error;
    }
    return json({ success: true });
  } catch (e) { return failure(e); }
}
