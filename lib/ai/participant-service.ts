import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getPool, initDatabase } from "../db";
import {
  body,
  sameOrigin,
  HttpError,
  json,
  participant,
  publicSession,
  cookieName,
  digest,
  ownsSession,
  rate,
} from "../security";
import { getSession } from "./storage-mysql";
import {
  getNextInterviewStep,
  generateComprehensiveReport,
} from "./groq-service";
import { ANSWERS, PROTOCOL_VERSION } from "./protocol";
export async function start(r: NextRequest) {
  const b = await body(r);
  if (b.consentGiven !== true)
    throw new HttpError(400, "Leia o aviso e confirme sua participação.");
  await initDatabase();
  await rate("start:" + String(b.linkId), 8, 3600);
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const [rows]: any = await c.execute(
      "SELECT l.*, b.context, b.closed_at AS batch_closed FROM survey_links l JOIN management_batches b ON b.id=l.batch_id WHERE l.id=? FOR UPDATE",
      [String(b.linkId)],
    );
    const l = rows[0];
    if (!l || l.batch_closed || l.used || !l.active)
      throw new HttpError(
        403,
        "Link indisponível. Solicite uma campanha nova ao gestor.",
      );
    if (l.closed_by_session_id) {
      const old = await getSession(l.closed_by_session_id);
      if (old && ownsSession(r, old)) {
        await c.rollback();
        return json({
          success: true,
          sessionId: old.id,
          session: publicSession(old),
        });
      }
      throw new HttpError(
        409,
        "Este link já foi reservado em outro navegador.",
      );
    }
    const id = "ses_" + randomBytes(24).toString("base64url"),
      token = randomBytes(32).toString("base64url");
    const s: any = {
      id,
      linkId: l.id,
      status: "in_progress",
      profile: {
        sector: l.sector,
        context: l.context,
        protocolVersion: PROTOCOL_VERSION,
      },
      lgpdConsent: {
        consentGiven: true,
        noticeVersion: "2026-09-25.2",
        timestamp: new Date().toISOString(),
        voiceConsent: b.voiceConsent === true,
        tokenHash: digest(token),
      },
      history: [],
    };
    s.currentStepData = await getNextInterviewStep(s);
    await c.execute(
      "INSERT INTO sessions (id,link_id,status,profile,lgpd_consent,history,current_step_data) VALUES (?,?,?,?,?,?,?)",
      [
        id,
        l.id,
        s.status,
        JSON.stringify(s.profile),
        JSON.stringify(s.lgpdConsent),
        "[]",
        JSON.stringify(s.currentStepData),
      ],
    );
    await c.execute(
      "UPDATE survey_links SET closed_by_session_id=? WHERE id=?",
      [id, l.id],
    );
    await c.commit();
    const res = json({
      success: true,
      sessionId: id,
      session: publicSession(s),
    });
    res.cookies.set(cookieName(id), token, {
      httpOnly: true,
      secure: r.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 86400 * 7,
    });
    return res;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function answer(r: NextRequest, id: string) {
  const b = await body(r),
    s = await participant(r, id);
  await rate("answer:" + id, 25);
  const step = s.currentStepData;
  if (
    s.status !== "in_progress" ||
    step?.protocol_version !== PROTOCOL_VERSION ||
    b.stepId !== step.step_id
  )
    throw new HttpError(409, "A pergunta mudou. Recarregue a conversa.");
  if (
    typeof b.userAnswer !== "string" ||
    !b.userAnswer.trim() ||
    b.userAnswer.length > 2000
  )
    throw new HttpError(
      400,
      "Responda em até 2.000 caracteres ou escolha pular.",
    );
  if (
    step.kind === "rating" &&
    !(ANSWERS as readonly string[]).includes(b.userAnswer)
  )
    throw new HttpError(400, "Escolha uma das frequências apresentadas.");
  const before = JSON.stringify(s.history);
  s.history.push({
    stepId: step.step_id,
    kind: step.kind,
    dimensionTarget: step.dimension_target,
    userAnswer: b.userAnswer.trim(),
  });
  s.status = step.is_interview_complete ? "ready_for_report" : "in_progress";
  if (s.status === "in_progress")
    s.currentStepData = await getNextInterviewStep(s);
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const [links]: any = await c.execute(
      "SELECT l.id FROM survey_links l JOIN management_batches b ON b.id=l.batch_id WHERE l.id=? AND l.active=1 AND b.closed_at IS NULL FOR UPDATE",
      [s.linkId ?? null],
    );
    if (!links.length) throw new HttpError(409, "Esta campanha foi encerrada.");
    const [rows]: any = await c.execute(
      "SELECT history,status FROM sessions WHERE id=? FOR UPDATE",
      [id],
    );
    const hist =
      typeof rows[0].history === "string"
        ? JSON.parse(rows[0].history)
        : rows[0].history;
    if (rows[0].status !== "in_progress" || JSON.stringify(hist) !== before)
      throw new HttpError(409, "Resposta já recebida. Recarregue a conversa.");
    await c.execute(
      "UPDATE sessions SET history=?,status=?,current_step_data=? WHERE id=?",
      [
        JSON.stringify(s.history),
        s.status,
        JSON.stringify(s.currentStepData),
        id,
      ],
    );
    await c.commit();
    return json({
      success: true,
      isCompleted: s.status === "ready_for_report",
      nextStep: s.currentStepData,
      session: publicSession(s),
    });
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function finish(r: NextRequest, id: string) {
  sameOrigin(r);
  const s = await participant(r, id);
  if (s.status === "completed") return json({ success: true });
  if (s.status !== "ready_for_report")
    throw new HttpError(
      409,
      "Responda ou pule as perguntas antes de concluir.",
    );
  const report = await generateComprehensiveReport(s),
    c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const [ls]: any = await c.execute(
      "SELECT l.id FROM survey_links l JOIN management_batches b ON b.id=l.batch_id WHERE l.id=? AND l.active=1 AND b.closed_at IS NULL FOR UPDATE",
      [s.linkId ?? null],
    );
    if (!ls.length) throw new HttpError(409, "Campanha encerrada.");
    const [ss]: any = await c.execute(
      "SELECT status FROM sessions WHERE id=? FOR UPDATE",
      [id],
    );
    if (ss[0].status !== "ready_for_report")
      throw new HttpError(409, "Participação já processada.");
    await c.execute(
      "INSERT INTO reports (id,session_id,link_id,sector,risk_level,confidence_score,dimensions,full_report) VALUES (?,?,?,?,?,?,?,?)",
      [
        id,
        id,
        s.linkId,
        s.profile.sector,
        "not_assessed",
        0,
        JSON.stringify(report.dimensions),
        JSON.stringify(report),
      ],
    );
    await c.execute(
      "UPDATE sessions SET status='completed',report_id=?,completed_at=NOW() WHERE id=?",
      [id, id],
    );
    await c.execute(
      "UPDATE survey_links SET active=0,used=1,closed_at=NOW() WHERE id=?",
      [s.linkId ?? null],
    );
    await c.commit();
    return json({ success: true });
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
