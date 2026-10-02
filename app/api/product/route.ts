import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { admin, body, failure, HttpError, json, rate, textField } from "@/lib/security";
import { supabaseAdmin } from "@/lib/db";
import { createRunAndInvites, ownedOrganization, ownedRun, ownedTemplate, privacyWarnings, validateQuestions } from "@/lib/product/surveys";
import { generateDraft, masterDraft } from "@/lib/product/draft";
import { dataOrThrow } from "@/lib/product/store";

import { getSectorsForUser, saveSectorProfile } from "@/lib/product/sectors";

export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    const organizations = dataOrThrow(await supabaseAdmin.from("product_organizations")
      .select("id,name,created_at").eq("owner_user_id", a.userId).order("name"));
    const organizationIds = organizations.map((organization) => organization.id);
    const templates = organizationIds.length ? dataOrThrow(await supabaseAdmin.from("product_templates")
      .select("id,organization_id,kind,title,description,questions,invites_per_run,active,created_at")
      .in("organization_id", organizationIds).neq("kind", "sector_profile").order("created_at", { ascending: false })) : [];
    const rawRuns = organizationIds.length ? dataOrThrow(await supabaseAdmin.from("product_runs")
      .select("id,organization_id,template_id,title,sector,opened_at,closed_at,paused,scheduled_at,cycle_number,cycle_group")
      .in("organization_id", organizationIds).order("opened_at", { ascending: false }).limit(100)) : [];
    const runs = await Promise.all(rawRuns.map(async (run) => {
      const [{ count: invited, error: invitedError }, { count: completed, error: completedError }] = await Promise.all([
        supabaseAdmin.from("product_invites").select("token_hash", { count: "exact", head: true }).eq("run_id", run.id),
        supabaseAdmin.from("product_answers").select("id", { count: "exact", head: true }).eq("run_id", run.id),
      ]);
      if (invitedError || completedError) throw new Error(invitedError?.message || completedError?.message);
      return { ...run, invited: invited || 0, completed: completed || 0 };
    }));
    const sectors = await getSectorsForUser(a.userId);
    return json({ organizations, templates, runs, sectors });
  } catch (e) { return failure(e); }
}

export async function POST(r: NextRequest) {
  try {
    const a = await admin(r);
    const b = await body(r);
    const action = String(b.action || "");
    await rate(`product:${a.userId}`, 60, 3600);

    if (action === "save-sector") {
      const orgId = String(b.organizationId || "");
      const result = await saveSectorProfile(a.userId, orgId, {
        id: b.id ? String(b.id) : undefined,
        name: textField(b.name, 2, 100, "Nome do setor"),
        roles: Array.isArray(b.roles) && b.roles.length ? b.roles.map(String) : ["Geral"],
        workModel: b.workModel === "remoto" || b.workModel === "hibrido" ? b.workModel : "presencial",
        routineDescription: String(b.routineDescription || "").slice(0, 2000),
        plannedBaseline: b.plannedBaseline || { volume: 3, clarity: 4, autonomy: 3, support: 4, recognition: 4, relations: 4 },
        shiftHours: Number(b.shiftHours || 8),
        hasOvertimeExpected: !!b.hasOvertimeExpected,
        breakPolicy: String(b.breakPolicy || "Pausa padrão.").slice(0, 500),
      });
      return json({ success: true, ...result });
    }

    if (action === "organization") {
      const name = textField(b.name, 2, 160, "Nome da empresa");
      const { data: existing, error: existingError } = await supabaseAdmin.from("product_organizations")
        .select("id").eq("owner_user_id", a.userId).limit(1);
      if (existingError) throw new Error(existingError.message);
      if (existing?.length) throw new HttpError(409, "Sua conta já possui uma empresa cadastrada.");
      const id = randomUUID();
      dataOrThrow(await supabaseAdmin.from("product_organizations")
        .insert({ id, owner_user_id: a.userId, name }).select("id"));
      return json({ id });
    }

    if (action === "draft") {
      const kind = b.kind === "master" ? "master" : "custom";
      if (kind === "master") return json({ questions: masterDraft(), source: "protocol" });
      const objective = textField(b.objective, 15, 1000, "Objetivo");
      const sector = textField(b.sector || "Geral", 2, 100, "Área ou setor");
      const sectorContext = b.sectorContext as Record<string, any> | undefined;
      return json(await generateDraft(objective, sector, sectorContext));
    }

    if (action === "update-template") {
      const template = await ownedTemplate(a.userId, String(b.templateId || ""));
      const questions = validateQuestions(b.questions);
      const warnings = privacyWarnings(questions);
      if (warnings.length) throw new HttpError(400, warnings.join(" "));
      const title = textField(b.title, 3, 160, "Título");
      const kind = b.kind === "master" || b.kind === "custom" ? b.kind : template.kind;
      dataOrThrow(await supabaseAdmin.from("product_templates").update({ title, kind, questions, description: String(b.description || "").slice(0,2000), updated_at: new Date().toISOString() }).eq("id", template.id).select("id"));
      return json({ id: template.id });
    }

    if (action === "template") {
      const organizationId = String(b.organizationId || "");
      await ownedOrganization(a.userId, organizationId);
      const kind = b.kind === "master" ? "master" : b.kind === "custom" ? "custom" : null;
      if (!kind) throw new HttpError(400, "Tipo de pesquisa inválido.");
      const title = textField(b.title, 3, 160, "Título");
      const description = typeof b.description === "string" ? b.description.trim().slice(0, 2000) : "";
      const questions = validateQuestions(b.questions);
      const warnings = privacyWarnings(questions);
      if (warnings.length) throw new HttpError(400, warnings.join(" "));
      const quantity = Number(b.invitesPerRun || 10);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
        throw new HttpError(400, "Quantidade de convites inválida.");
      const id = randomUUID();
      dataOrThrow(await supabaseAdmin.from("product_templates").insert({
        id, organization_id: organizationId, kind, title, description, questions,
        recurrence_months: null, next_run_at: null,
        invites_per_run: quantity,
      }).select("id"));
      return json({ id });
    }

    if (action === "run") {
      const template = await ownedTemplate(a.userId, String(b.templateId || ""));
      const sector = textField(b.sector || "Geral", 2, 100, "Setor");
      const quantity = Number(b.quantity || template.invites_per_run);
      const runResult = await createRunAndInvites(a.userId, template.id, sector, quantity);
      return json({ ...runResult, singleLink: `${process.env.NEXT_PUBLIC_APP_URL || ""}/responder/${runResult.runId}` });
    }

    if (action === "close") {
      const run = await ownedRun(a.userId, String(b.runId || ""));
      dataOrThrow(await supabaseAdmin.from("product_runs")
        .update({ closed_at: new Date().toISOString() }).eq("id", run.id).is("closed_at", null).select("id"));
      return json({ success: true });
    }

    if (action === "reopen") {
      const run = await ownedRun(a.userId, String(b.runId || ""));
      dataOrThrow(await supabaseAdmin.from("product_runs")
        .update({ closed_at: null, paused: false }).eq("id", run.id).select("id"));
      return json({ success: true });
    }

    if (action === "pause") {
      const run = await ownedRun(a.userId, String(b.runId || ""));
      dataOrThrow(await supabaseAdmin.from("product_runs")
        .update({ paused: true }).eq("id", run.id).select("id"));
      return json({ success: true });
    }

    if (action === "schedule-run") {
      const template = await ownedTemplate(a.userId, String(b.templateId || ""));
      const sector = textField(b.sector || "Toda a empresa", 2, 100, "Setor");
      const quantity = Number(b.quantity || template.invites_per_run || 30);
      const scheduledAt = String(b.scheduledAt || new Date(Date.now() + 86400000).toISOString());
      const repeat = String(b.repeat || "none");
      const repeatCount = Math.min(52, Math.max(1, Number(b.repeatCount || 1)));
      const cycleGroup = repeat !== "none" ? randomUUID() : null;
      const repeatMs = repeat === "weekly" ? 7*86400000 : repeat === "biweekly" ? 14*86400000 : repeat === "monthly" ? 30*86400000 : 0;
      const runs: string[] = [];
      const total = repeat !== "none" ? repeatCount : 1;
      for (let i = 0; i < total; i++) {
        const runId = randomUUID();
        const runScheduledAt = new Date(new Date(scheduledAt).getTime() + i * repeatMs).toISOString();
        dataOrThrow(await supabaseAdmin.from("product_runs").insert({
          id: runId,
          organization_id: template.organization_id,
          template_id: template.id,
          title: template.title + (total > 1 ? ` — Ciclo ${i+1}` : ""),
          sector,
          questions: template.questions,
          opened_at: runScheduledAt,
          closed_at: null,
          paused: false,
          scheduled_at: runScheduledAt,
          cycle_number: total > 1 ? i + 1 : null,
          cycle_group: cycleGroup,
        }).select("id"));
        runs.push(runId);
      }
      return json({ success: true, scheduled: runs.length, cycleGroup });
    }

    if (action === "disable") {
      const template = await ownedTemplate(a.userId, String(b.templateId || ""));
      dataOrThrow(await supabaseAdmin.from("product_templates")
        .update({ active: false, next_run_at: null, updated_at: new Date().toISOString() })
        .eq("id", template.id).select("id"));
      return json({ success: true });
    }

    throw new HttpError(400, "Ação inválida.");
  } catch (e) { return failure(e); }
}
