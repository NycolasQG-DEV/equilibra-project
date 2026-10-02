import { supabaseAdmin } from '@/lib/db';
import { aggregate, MIN_RELEASE, type Question } from './surveys';
import { DIMENSIONS } from '@/lib/ai/protocol';

export async function reportForRun(run: { id: string; title: string; sector: string; questions: Question[]; closed_at: string | null; opened_at: string }) {
  const rows: { answers: Record<string, unknown>; sentiment: Record<string, string> }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from('product_answers').select('id,answers,sentiment').eq('run_id', run.id).order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { count: invited, error } = await supabaseAdmin.from('product_invites').select('token_hash', { count: 'exact', head: true }).eq('run_id', run.id);
  if (error) throw error;
  const questions = run.closed_at ? aggregate(run.questions, rows) : [];
  const findings = questions.flatMap(q => {
    const dimension = DIMENSIONS.find(d => d.id === q.id && d.question === q.text);
    if (!dimension || !q.count || !q.counts) return [];
    return [{ id: q.id, name: dimension.name, text: q.text, count: q.count,
      percent: Math.round(100 * (q.counts[3] + q.counts[4]) / q.count), action: dimension.action }];
  });
  return { id: run.id, title: run.title, sector: run.sector, openedAt: run.opened_at, closedAt: run.closed_at,
    closed: !!run.closed_at, released: !!run.closed_at && rows.length >= MIN_RELEASE,
    completed: rows.length, invited: invited || 0, minimum: MIN_RELEASE, questions, findings,
    actionSuggestions: findings.filter(f => f.percent >= 30).map(f => ({ questionId: f.id, ...f.action, percent: f.percent, status: 'sugestão para avaliação de SST' })),
    note: 'Percepção das condições de trabalho. A frequência observada não é probabilidade de adoecimento. Sinais textuais usam palavras-chave; este relatório subsidia a avaliação técnica e não constitui PGR completo.' };
}
