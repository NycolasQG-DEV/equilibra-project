import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  admin,
  body,
  failure,
  json,
  HttpError,
  textField,
} from "@/lib/security";
import { dashboard } from "@/lib/management/service";
import { queryOne, execute } from "@/lib/db";
import { DIMENSIONS } from "@/lib/ai/protocol";
export async function POST(r: NextRequest) {
  try {
    const a = await admin(r),
      b = await body(r);
    const d = await dashboard(a.userId),
      batch = d.batches.find((x) => x.id === b.batchId),
      finding = batch?.dimensions.find((x) => x.id === b.dimensionId);
    if (!batch?.released || finding?.percent === null || !finding)
      throw new HttpError(409, "Ação exige um resultado coletivo divulgável.");
    const owner = textField(b.owner, 2, 150, "Responsável"),
      date = String(b.dueDate || "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date < new Date().toISOString().slice(0, 10)
    )
      throw new HttpError(400, "Escolha um prazo válido a partir de hoje.");
    const plan = DIMENSIONS.find((x) => x.id === b.dimensionId)!.action;
    await execute(
      "INSERT INTO management_actions(id,admin_id,batch_id,dimension_id,title,plan,owner,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ON CONSTRAINT idx_unique_action DO NOTHING",
      [
        randomUUID(),
        a.userId,
        b.batchId,
        b.dimensionId,
        plan.title,
        JSON.stringify(plan),
        owner,
        date,
      ],
    );
    return json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(r: NextRequest) {
  try {
    const a = await admin(r),
      b = await body(r);
    if (!["planned", "progress", "done"].includes(b.status))
      throw new HttpError(400, "Status inválido.");
    const evidence =
      b.status === "done"
        ? textField(b.evidence, 10, 2000, "Evidência de execução")
        : String(b.evidence || "").slice(0, 2000);
    const found = await queryOne(
      "SELECT id FROM management_actions WHERE id=? AND admin_id=?",
      [b.id, a.userId],
    );
    if (!found) throw new HttpError(404, "Ação indisponível.");
    await execute(
      "UPDATE management_actions SET status=?,evidence=?,completed_at=IF(?='done',COALESCE(completed_at,NOW()),NULL) WHERE id=? AND admin_id=?",
      [b.status, evidence, b.status, b.id, a.userId],
    );
    return json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
