import { randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/db";
import { DIMENSIONS } from "@/lib/ai/protocol";
import { HttpError, digest } from "@/lib/security";
import { dataOrThrow, ownedOrganizationIds, ownedRunIds } from "./store";
import { LIKERT, Question, SurveyKind } from "./shared";

export type { Question, SurveyKind } from "./shared";
export { privacyWarnings } from "./shared";
export const MIN_RELEASE = 5;

export const MASTER_QUESTIONS: Question[] = DIMENSIONS.map((d) => ({
  id: d.id,
  type: "likert",
  text: d.question,
}));

export function validateQuestions(value: unknown): Question[] {
  if (!Array.isArray(value) || value.length < 5 || value.length > 10)
    throw new HttpError(400, "Informe de 5 a 10 perguntas.");
  const ids = new Set<string>();
  const questions = value.map((v, i) => {
    if (!v || typeof v !== "object") throw new HttpError(400, `Pergunta ${i + 1} inválida.`);
    const q = v as Record<string, unknown>;
    const id = typeof q.id === "string" ? q.id.trim() : "";
    const text = typeof q.text === "string" ? q.text.trim() : "";
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ids.has(id) || text.length < 12 || text.length > 280 || (q.type !== "likert" && q.type !== "text"))
      throw new HttpError(400, `Pergunta ${i + 1} inválida ou repetida.`);
    ids.add(id);
    return { id, type: q.type as Question["type"], text };
  });
  if (!questions.some((q) => q.type === "likert") || !questions.some((q) => q.type === "text"))
    throw new HttpError(400, "Inclua perguntas de escala e perguntas abertas.");
  return questions;
}

export async function ownedOrganization(userId: string, organizationId: string) {
  const { data: org, error } = await supabaseAdmin.from("product_organizations")
    .select("id,name").eq("id", organizationId).eq("owner_user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new HttpError(404, "Empresa indisponível.");
  return org;
}

export async function ownedTemplate(userId: string, templateId: string) {
  const { data: row, error } = await supabaseAdmin.from("product_templates")
    .select("*").eq("id", templateId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new HttpError(404, "Pesquisa indisponível.");
  await ownedOrganization(userId, row.organization_id);
  return row;
}

export async function ownedRun(userId: string, runId: string) {
  const { data: row, error } = await supabaseAdmin.from("product_runs")
    .select("*").eq("id", runId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new HttpError(404, "Rodada indisponível.");
  await ownedOrganization(userId, row.organization_id);
  return row;
}

export async function createRunAndInvites(userId: string, templateId: string, sector: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
    throw new HttpError(400, "Quantidade inválida.");
  const t = await ownedTemplate(userId, templateId);
  if (!t.active) throw new HttpError(404, "Pesquisa indisponível.");
  const { data: user, error: userError } = await supabaseAdmin.from("users")
    .select("max_colaboradores").eq("id", userId).single();
  if (userError) throw new Error(userError.message);
  const limit = Number(user.max_colaboradores || 0);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const runIds = await ownedRunIds(userId);
  const [{ count: productCount, error: productError }, { count: legacyCount, error: legacyError }] = await Promise.all([
    runIds.length ? supabaseAdmin.from("product_invites").select("token_hash", { count: "exact", head: true })
      .in("run_id", runIds).gte("created_at", monthStart.toISOString()) : Promise.resolve({ count: 0, error: null }),
    supabaseAdmin.from("survey_links").select("id", { count: "exact", head: true })
      .eq("admin_id", userId).gte("created_at", monthStart.toISOString()),
  ]);
  if (productError || legacyError) throw new Error(productError?.message || legacyError?.message);
  if ((productCount || 0) + (legacyCount || 0) + quantity > limit)
    throw new HttpError(403, "A quantidade excede a cota mensal de convites do plano.");

  const runId = randomUUID();
  dataOrThrow(await supabaseAdmin.from("product_runs").insert({
    id: runId, organization_id: t.organization_id, template_id: t.id,
    title: t.title, sector, questions: t.questions,
  }).select("id"));
  const tokens = Array.from({ length: quantity }, () => randomBytes(24).toString("base64url"));
  const invites = tokens.map((token) => ({ token_hash: digest(token), run_id: runId }));
  try {
    for (let offset = 0; offset < invites.length; offset += 500) {
      dataOrThrow(await supabaseAdmin.from("product_invites")
        .insert(invites.slice(offset, offset + 500)).select("token_hash"));
    }
  } catch (error) {
    await supabaseAdmin.from("product_invites").delete().eq("run_id", runId);
    await supabaseAdmin.from("product_runs").delete().eq("id", runId);
    throw error;
  }
  return { runId, tokens };
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Classificação conservadora local. Nenhum comentário livre é enviado ao provedor de IA.
export function sentiment(text: string): "positive" | "neutral" | "negative" | "critical" {
  const s = normalizeText(text);
  if (/assedio|ameaca|violencia|agressao|discriminacao|retaliacao/.test(s)) return "critical";
  if (/sobrecarga|exaust|esgot|humilh|medo|pressao|cansac|ansied|insegur/.test(s)) return "negative";
  if (/apoio|melhor|respeito|bom ambiente|satisfeit|equilibr/.test(s)) return "positive";
  return "neutral";
}

export function aggregate(questions: Question[], rows: { answers: Record<string, unknown>; sentiment: Record<string, string> }[]) {
  const released = rows.length >= MIN_RELEASE;
  return questions.map((q) => {
    const values = rows.map((r) => r.answers?.[q.id]);
    if (q.type === "likert") {
      const valid = values.filter((v): v is number => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 5);
      const counts = LIKERT.map((_, i) => valid.filter((v) => v === i + 1).length);
      const safe = released && valid.length >= MIN_RELEASE && counts.every((n) => n === 0 || n >= 3);
      return { id: q.id, text: q.text, type: q.type, count: safe ? valid.length : null, counts: safe ? counts : null };
    }
    const valid = values.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    const counts = ["positive", "neutral", "negative", "critical"].map((label) => rows.filter((r) => r.sentiment?.[q.id] === label).length);
    const safe = released && valid.length >= MIN_RELEASE && counts.every((n) => n === 0 || n >= 3);
    return { id: q.id, text: q.text, type: q.type, count: safe ? valid.length : null, sentiment: safe ? counts : null };
  });
}
