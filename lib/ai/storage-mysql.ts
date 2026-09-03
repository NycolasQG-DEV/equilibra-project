import { query, queryOne, execute, initDatabase } from "@/lib/db";

export interface SurveyLink {
  id: string;
  title: string;
  sector: string;
  role?: string | null;
  adminId?: string | null;
  adminName?: string;
  adminEmail?: string;
  batchId?: string | null;
  active: boolean;
  used: boolean;
  createdAt: string;
  closedAt?: string | null;
  closedBySessionId?: string | null;
  totalSessions?: number;
  completedReports?: number;
  lastResponseAt?: string;
}

export interface SessionData {
  id: string;
  linkId?: string | null;
  status: string;
  profile: any;
  lgpdConsent: any;
  history: any[];
  currentStepData?: any;
  reportId?: string | null;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string;
}

export interface ReportData {
  id: string;
  sessionId: string;
  linkId?: string | null;
  sector?: string | null;
  profile: any;
  riskLevel: string;
  confidenceScore: number;
  dimensions: any;
  actionPlan?: any;
  fullReport: any;
  createdAt: string;
}

export interface AuditLogEntry {
  action: string;
  targetId?: string | null;
  performedBy: string;
  sector?: string | null;
  legalBasis?: string | null;
  details: string;
}

export function maskProfileForEmployer(profile: any, sessionId?: string) {
  if (!profile) return profile;
  const cleanId = (sessionId || "").replace("ses_", "").substring(0, 5).toUpperCase();
  return {
    ...profile,
    workerName: `Colaborador #${cleanId || "ANON"}`,
    realNameHidden: true,
    privacyNotice: "Identificação protegida por sigilo técnico de SST (LGPD Art. 13 / NR-01)",
  };
}


// ─── Survey Links ───

export async function saveSurveyLink(linkData: Partial<SurveyLink>): Promise<SurveyLink> {
  await initDatabase();
  const id = linkData.id || `lnk_${Math.random().toString(36).substring(2, 10)}`;
  const title = linkData.title || "Nova Campanha de Pesquisa";
  const sector = linkData.sector || "all";
  const role = linkData.role || null;
  const adminId = linkData.adminId || null;
  const adminName = linkData.adminName || "Gestor do Setor";
  const adminEmail = linkData.adminEmail || "";
  const batchId = linkData.batchId || null;
  const active = linkData.active !== undefined ? Boolean(linkData.active) : true;
  const used = linkData.used !== undefined ? Boolean(linkData.used) : false;

  await execute(
    `INSERT INTO survey_links (id, title, sector, role, admin_id, admin_name, admin_email, batch_id, active, used, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       sector = VALUES(sector),
       role = VALUES(role),
       active = VALUES(active),
       used = VALUES(used)`,
    [id, title, sector, role, adminId, adminName, adminEmail, batchId, active, used]
  );

  return {
    id,
    title,
    sector,
    role,
    adminId,
    adminName,
    adminEmail,
    batchId,
    active,
    used,
    createdAt: new Date().toISOString(),
  };
}

export async function getSurveyLink(linkId: string): Promise<SurveyLink | null> {
  await initDatabase();
  const row = await queryOne<any>(
    "SELECT * FROM survey_links WHERE id = $1",
    [linkId]
  );
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    sector: row.sector,
    role: row.role,
    adminId: row.admin_id,
    adminName: row.admin_name,
    adminEmail: row.admin_email,
    batchId: row.batch_id,
    active: Boolean(row.active),
    used: Boolean(row.used),
    createdAt: row.created_at,
    closedAt: row.closed_at,
    closedBySessionId: row.closed_by_session_id,
  };
}

export async function listSurveyLinks(adminId?: string): Promise<SurveyLink[]> {
  await initDatabase();
  const rows = adminId
    ? await query<any>("SELECT * FROM survey_links WHERE admin_id = $1 ORDER BY created_at DESC", [adminId])
    : await query<any>("SELECT * FROM survey_links ORDER BY created_at DESC");

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    sector: row.sector,
    role: row.role,
    adminId: row.admin_id,
    adminName: row.admin_name,
    adminEmail: row.admin_email,
    batchId: row.batch_id,
    active: Boolean(row.active),
    used: Boolean(row.used),
    createdAt: row.created_at,
    closedAt: row.closed_at,
    closedBySessionId: row.closed_by_session_id,
  }));
}

export async function toggleSurveyLinkStatus(linkId: string): Promise<SurveyLink | null> {
  await initDatabase();
  const current = await getSurveyLink(linkId);
  if (!current) return null;

  const nextActive = !current.active;
  await execute(
    "UPDATE survey_links SET active = $1 WHERE id = $2",
    [nextActive, linkId]
  );

  return { ...current, active: nextActive };
}

export async function closeSurveyLink(linkId: string, sessionId: string): Promise<SurveyLink | null> {
  await initDatabase();
  await execute(
    `UPDATE survey_links 
     SET active = false, used = true, closed_at = CURRENT_TIMESTAMP, closed_by_session_id = $1 
     WHERE id = $2`,
    [sessionId, linkId]
  );
  return getSurveyLink(linkId);
}

export async function deleteSurveyLink(linkId: string): Promise<boolean> {
  await initDatabase();
  const result = await execute("DELETE FROM survey_links WHERE id = $1", [linkId]);
  return result.rowCount > 0;
}

// ─── Sessions ───

export async function saveSession(session: SessionData): Promise<SessionData> {
  await initDatabase();
  const profileJson = JSON.stringify(session.profile || {});
  const lgpdConsentJson = JSON.stringify(session.lgpdConsent || {});
  const historyJson = JSON.stringify(session.history || []);
  const currentStepJson = session.currentStepData ? JSON.stringify(session.currentStepData) : null;
  const linkId = session.linkId || session.profile?.linkId || null;
  const reportId = session.reportId || null;

  await execute(
    `INSERT INTO sessions (id, link_id, status, profile, lgpd_consent, history, current_step_data, report_id, created_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       profile = VALUES(profile),
       history = VALUES(history),
       current_step_data = VALUES(current_step_data),
       report_id = VALUES(report_id),
       completed_at = IF(VALUES(status) = 'completed', CURRENT_TIMESTAMP, completed_at)`,
    [session.id, linkId, session.status, profileJson, lgpdConsentJson, historyJson, currentStepJson, reportId]
  );

  return session;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  await initDatabase();
  const row = await queryOne<any>(
    "SELECT * FROM sessions WHERE id = $1",
    [sessionId]
  );
  if (!row) return null;

  return {
    id: row.id,
    linkId: row.link_id,
    status: row.status,
    profile: typeof row.profile === "string" ? JSON.parse(row.profile) : row.profile,
    lgpdConsent: typeof row.lgpd_consent === "string" ? JSON.parse(row.lgpd_consent) : row.lgpd_consent,
    history: typeof row.history === "string" ? JSON.parse(row.history) : row.history,
    currentStepData: row.current_step_data
      ? (typeof row.current_step_data === "string" ? JSON.parse(row.current_step_data) : row.current_step_data)
      : null,
    reportId: row.report_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listSessions(sector?: string): Promise<SessionData[]> {
  await initDatabase();
  const rows = await query<any>("SELECT * FROM sessions ORDER BY created_at DESC");
  let sessions: SessionData[] = rows.map((row) => ({
    id: row.id,
    linkId: row.link_id,
    status: row.status,
    profile: typeof row.profile === "string" ? JSON.parse(row.profile) : row.profile,
    lgpdConsent: typeof row.lgpd_consent === "string" ? JSON.parse(row.lgpd_consent) : row.lgpd_consent,
    history: typeof row.history === "string" ? JSON.parse(row.history) : row.history,
    currentStepData: row.current_step_data
      ? (typeof row.current_step_data === "string" ? JSON.parse(row.current_step_data) : row.current_step_data)
      : null,
    reportId: row.report_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));

  if (sector && sector !== "all") {
    sessions = sessions.filter((s) => s.profile?.sector === sector);
  }

  return sessions;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  await initDatabase();
  const res = await execute("DELETE FROM sessions WHERE id = $1", [sessionId]);
  return res.rowCount > 0;
}

// ─── Reports ───

export async function saveReport(reportData: any): Promise<any> {
  await initDatabase();
  const id = reportData.id || `rep_${Math.random().toString(36).substring(2, 10)}`;
  const sessionId = reportData.sessionId || reportData.id;
  const linkId = reportData.linkId || reportData.profile?.linkId || null;
  const sector = reportData.profile?.sector || "Geral";
  const profileJson = JSON.stringify(reportData.profile || {});
  const riskLevel = reportData.overallRiskLevel || reportData.riskLevel || "Moderado";
  const confidenceScore = reportData.algorithmCertaintyScore || reportData.confidenceScore || 85;
  const dimensionsJson = JSON.stringify(reportData.dimensionsAssessment || reportData.dimensions || {});
  const actionPlanJson = JSON.stringify(reportData.actionPlan || reportData.action_plan_5w2h || {});
  const fullReportJson = JSON.stringify(reportData);

  await execute(
    `INSERT INTO reports (id, session_id, link_id, sector, profile, risk_level, confidence_score, dimensions, action_plan, full_report, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       risk_level = VALUES(risk_level),
       confidence_score = VALUES(confidence_score),
       dimensions = VALUES(dimensions),
       action_plan = VALUES(action_plan),
       full_report = VALUES(full_report)`,
    [id, sessionId, linkId, sector, profileJson, riskLevel, confidenceScore, dimensionsJson, actionPlanJson, fullReportJson]
  );

  return { ...reportData, id };
}

export async function getReport(reportId: string): Promise<any | null> {
  await initDatabase();
  const row = await queryOne<any>(
    "SELECT * FROM reports WHERE id = $1 OR session_id = $1",
    [reportId]
  );
  if (!row) return null;
  return typeof row.full_report === "string" ? JSON.parse(row.full_report) : row.full_report;
}

export async function listReports(sector?: string): Promise<any[]> {
  await initDatabase();
  const rows = await query<any>("SELECT * FROM reports ORDER BY created_at DESC");
  let reports = rows.map((row) => {
    const parsed = typeof row.full_report === "string" ? JSON.parse(row.full_report) : row.full_report;
    return {
      ...parsed,
      id: row.id,
      sessionId: row.session_id,
      linkId: row.link_id,
      sector: row.sector,
      createdAt: row.created_at,
    };
  });

  if (sector && sector !== "all") {
    reports = reports.filter((r) => r.profile?.sector === sector || r.sector === sector);
  }

  return reports;
}

// ─── Audit Logs ───

export async function logAuditAccess(entry: AuditLogEntry): Promise<void> {
  try {
    await initDatabase();
    await execute(
      `INSERT INTO audit_logs (action, target_id, performed_by, sector, legal_basis, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        entry.action,
        entry.targetId || null,
        entry.performedBy,
        entry.sector || null,
        entry.legalBasis || null,
        entry.details,
      ]
    );
  } catch (err: any) {
    console.warn("Aviso ao registrar log de auditoria:", err?.message);
  }
}

export async function listAuditLogs(): Promise<any[]> {
  await initDatabase();
  const rows = await query<any>("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.created_at,
    action: r.action,
    targetId: r.target_id,
    performedBy: r.performed_by,
    sector: r.sector,
    legalBasis: r.legal_basis,
    details: r.details,
  }));
}

// ─── DPO & RIPD ───

export function getDpoInfo() {
  return {
    name: "Comitê de Privacidade e Encarregado de Dados (DPO) • Equilibra SST",
    email: "dpo.privacidade@equilibra-sst.corp.br",
    channel: "Canal Oficial de Atendimento ao Titular de Dados e SESMT",
    legalAddress: "Setor de Segurança e Medicina do Trabalho & Compliance",
    responsibilities: [
      "Art. 41, § 2º, I: Aceitar reclamações e comunicações dos titulares e prestar esclarecimentos.",
      "Art. 41, § 2º, II: Receber comunicações da Autoridade Nacional de Proteção de Dados (ANPD).",
      "Art. 41, § 2º, III: Orientar funcionários e contratados sobre boas práticas e sigilo.",
      "NR-01 Item 1.4.1.1: Garantir canal de acolhimento e anonimato em situações de assédio.",
    ],
  };
}

export function getRipdReport() {
  return {
    documentTitle: "Relatório de Impacto à Proteção de Dados Pessoais (RIPD / DPIA)",
    normativeFramework: "Lei Federal nº 13.709/2018 (LGPD) e NR-01 (Portaria MTP nº 4.219 / MTE nº 1.419/2024)",
    systemName: "EquilibraAI / Equilibra SST — Avaliação Contínua de Riscos Psicossociais",
    scopeAndPurpose: {
      finalidade: "Mapeamento e gestão preventiva de fatores de risco psicossocial e ergonômico no trabalho (ISTAS21-BR), subsidiando o Programa de Gerenciamento de Riscos (PGR/GRO da NR-01).",
      baseLegal: 'Art. 7º, II (Cumprimento de obrigação legal e regulatória de SST pelo empregador) e Art. 11, II, "f" (Tutela da saúde ocupacional por profissionais de SST).',
      principioMinimizacao: "Coleta restrita às percepções de rotina de trabalho. Vedada a coleta de CPF, e-mail particular ou dados bancários.",
      kAnonimato: "Regra ativa de corte: setores com menos de 3 participantes são agrupados/mascarados nos dashboards executivos para impedir reidentificação indireta (Art. 12 da LGPD).",
    },
    riskAnalysisAndSafeguards: [
      {
        riscoIdentificado: "Identificação ou retaliação do colaborador pelo gestor direto.",
        medidaMitigadora: "Opção de anonimato total (Privacy by Default), isolamento do identificador por UUID, restrição de acesso do gestor a dados agregados por setor e proibição legal expressa de uso em prejuízo (Art. 21 da LGPD).",
      },
      {
        riscoIdentificado: "Vazamento de dados sensíveis de saúde mental.",
        medidaMitigadora: "Criptografia em trânsito e repouso, trilha de auditoria (audit logs) registrando todos os acessos do ADM, e controle de acesso restrito ao SESMT/CIPA.",
      },
      {
        riscoIdentificado: "Decisões automatizadas discriminatórias tomadas por IA.",
        medidaMitigadora: "Conformidade com Art. 20 da LGPD: A IA atua exclusivamente como ferramenta de apoio diagnóstico prévio. Todas as medidas preventivas são validadas e conduzidas por equipe humana (Engenheiro de Segurança, Médico do Trabalho e CIPA).",
      },
    ],
    rightsChannel: {
      acesso: "Disponibilizado imediatamente na interface do trabalhador (Art. 19, I).",
      eliminacao: "Botão de exclusão com purga completa de banco de dados e arquivos (Art. 18, VI).",
      portabilidade: "Exportação dos dados em formato digital estruturado e interoperável JSON (Art. 18, V).",
    },
  };
}
