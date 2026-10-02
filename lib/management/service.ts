import { query } from "../db";
import { Batch, Observation, summarize } from "./analytics";
const parsed = (x: any) => (typeof x === "string" ? JSON.parse(x) : x);
export async function dashboard(adminId: string) {
  const [rows, sessions, actions, legacy] = await Promise.all([
    query(
      "SELECT b.*,COUNT(l.id) invited,COALESCE(SUM(l.used),0) completed FROM management_batches b LEFT JOIN survey_links l ON l.batch_id=b.id AND l.admin_id=b.admin_id WHERE b.admin_id=? GROUP BY b.id ORDER BY b.created_at ASC,b.id ASC",
      [adminId],
    ),
    query(
      "SELECT s.id,s.profile,s.history,l.batch_id FROM sessions s JOIN survey_links l ON l.id=s.link_id AND l.closed_by_session_id=s.id JOIN management_batches b ON b.id=l.batch_id AND b.admin_id=l.admin_id WHERE l.admin_id=? AND s.status='completed'",
      [adminId],
    ),
    query(
      "SELECT id,batch_id,dimension_id,title,plan,owner,due_date,status,evidence,completed_at,created_at FROM management_actions WHERE admin_id=? ORDER BY due_date ASC",
      [adminId],
    ),
    query(
      "SELECT COUNT(*) count FROM survey_links l LEFT JOIN management_batches b ON b.id=l.batch_id WHERE l.admin_id=? AND b.id IS NULL",
      [adminId],
    ),
  ]);
  const observations: Observation[] = sessions.map((s) => ({
    id: s.id,
    batchId: s.batch_id,
    protocolVersion: parsed(s.profile)?.protocolVersion,
    history: parsed(s.history) || [],
  }));
  const batches = rows.map((b) =>
    summarize(
      {
        id: b.id,
        title: b.title,
        sector: b.sector,
        createdAt: new Date(b.created_at).toISOString(),
        closedAt: b.closed_at ? new Date(b.closed_at).toISOString() : null,
        protocolVersion: b.protocol_version,
        invited: Number(b.invited),
        completed: Number(b.completed),
      } as Batch,
      observations,
    ),
  );
  return {
    batches,
    actions: actions.map((a) => ({
      ...a,
      plan: parsed(a.plan),
      due_date: new Date(a.due_date).toISOString().slice(0, 10),
    })),
    legacyLinks: Number(legacy[0]?.count || 0),
    generatedAt: new Date().toISOString(),
    methodology: {
      minimumGroup: 10,
      period: "Últimas duas semanas",
      measure:
        "Percentual de respostas Frequentemente ou Sempre entre respostas válidas.",
      limitations:
        "Instrumento próprio de percepção. Não classifica risco ocupacional e não substitui a avaliação das condições de trabalho, o inventário de riscos ou o plano de ação do PGR.",
    },
  };
}
