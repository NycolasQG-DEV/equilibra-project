import { queryOne, initDatabase } from "@/lib/db";
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
}
const parse = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
export async function getSession(id: string): Promise<SessionData | null> {
  await initDatabase();
  const row = await queryOne("SELECT * FROM sessions WHERE id=?", [id]);
  return row
    ? {
        id: row.id,
        linkId: row.link_id,
        status: row.status,
        profile: parse(row.profile),
        lgpdConsent: parse(row.lgpd_consent),
        history: parse(row.history) || [],
        currentStepData: parse(row.current_step_data),
        reportId: row.report_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      }
    : null;
}
export async function getReport(id: string) {
  await initDatabase();
  const row = await queryOne(
    "SELECT full_report FROM reports WHERE session_id=?",
    [id],
  );
  return row ? parse(row.full_report) : null;
}
export function getDpoInfo() {
  return {
    name: process.env.PRIVACY_CONTACT_NAME || null,
    email: process.env.PRIVACY_CONTACT || null,
    configured: !!process.env.PRIVACY_CONTACT,
    notice:
      "O controlador deve informar o contato responsável, os prazos de retenção e a forma de atender direitos dos titulares.",
  };
}
export function getRipdReport() {
  return {
    documentTitle: "Informações para elaboração do RIPD",
    status:
      "Requer avaliação e aprovação do controlador. Não é um RIPD concluído.",
    scope:
      "Instrumento próprio de percepção das condições de trabalho para apoiar a gestão de riscos.",
    safeguards: [
      "Gestor recebe apenas agregados de campanhas encerradas.",
      "Pelo menos 10 participantes válidos por tema e proteção de subcontagens pequenas.",
      "Acesso do participante vinculado a cookie HttpOnly.",
      "IA sem ferramentas, com respostas restritas a identificadores validados.",
    ],
    pending: [
      "Documentar bases legais adequadas à finalidade e às categorias de dados.",
      "Definir retenção, exclusão, canais e procedimentos para direitos dos titulares.",
      "Avaliar contratos com operadores, transferências internacionais e recursos de voz do navegador.",
      "Configurar TLS, proteção de backups, criptografia em repouso e controle dos acessos operacionais.",
      "Avaliar risco residual de reidentificação e validar o instrumento com os responsáveis de SST.",
    ],
    contact: getDpoInfo(),
  };
}
