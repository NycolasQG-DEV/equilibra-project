import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { admin, body, failure, HttpError, json, textField } from '@/lib/security';
import { supabaseAdmin } from '@/lib/db';
import { ownedRun } from '@/lib/product/surveys';
import { reportForRun } from '@/lib/product/report';
export async function POST(r: NextRequest) {
  try {
    const a = await admin(r), b = await body(r);
    const report = await reportForRun(await ownedRun(a.userId, String(b.runId || '')));
    const finding = report.findings.find(f => f.id === b.dimensionId);
    if (!report.released || !finding) throw new HttpError(409, 'A ação exige um resultado agregado disponível da base de condições de trabalho.');
    const owner = textField(b.owner, 2, 150, 'Responsável');
    const dueDate = String(b.dueDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate || dueDate < new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Informe um prazo válido a partir de hoje.');
    const title = textField(b.title || finding.action.title, 3, 255, 'Medida');
    const { error } = await supabaseAdmin.from('management_actions').insert({ id: randomUUID(), admin_id: a.userId, batch_id: report.id, dimension_id: finding.id,
      title, plan: { ...finding.action, baseline: finding.percent, basis: finding.text, sector: report.sector }, owner, due_date: dueDate, status: 'planned' });
    if (error?.code === '23505') throw new HttpError(409, 'Já existe uma ação para este achado nesta rodada.');
    if (error) throw error;
    return json({ success: true }, 201);
  } catch (e) { return failure(e); }
}
export async function PATCH(r: NextRequest) {
  try {
    const a = await admin(r), b = await body(r);
    if (!['planned', 'progress', 'done'].includes(b.status)) throw new HttpError(400, 'Status inválido.');
    const evidence = b.status === 'done' ? textField(b.evidence, 10, 2000, 'Evidência de execução') : String(b.evidence || '').slice(0, 2000);
    const { data: found, error: readError } = await supabaseAdmin.from('management_actions').select('batch_id,completed_at').eq('id', String(b.id)).eq('admin_id', a.userId).maybeSingle();
    if (readError) throw readError;
    if (!found) throw new HttpError(404, 'Ação indisponível.');
    await ownedRun(a.userId, found.batch_id);
    const { error } = await supabaseAdmin.from('management_actions').update({ status: b.status, evidence, completed_at: b.status === 'done' ? found.completed_at || new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', String(b.id)).eq('admin_id', a.userId);
    if (error) throw error;
    return json({ success: true });
  } catch (e) { return failure(e); }
}
