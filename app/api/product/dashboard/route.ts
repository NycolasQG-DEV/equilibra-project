import { NextRequest } from 'next/server';
import { admin, failure, json } from '@/lib/security';
import { supabaseAdmin } from '@/lib/db';
import { dataOrThrow, ownedOrganizationIds } from '@/lib/product/store';
import { reportForRun } from '@/lib/product/report';
export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    const ids = await ownedOrganizationIds(a.userId);
    const organizations = ids.length ? dataOrThrow(await supabaseAdmin.from('product_organizations').select('id,name').in('id', ids)) : [];
    const runs = ids.length ? dataOrThrow(await supabaseAdmin.from('product_runs').select('*').in('organization_id', ids).order('opened_at', { ascending: false }).limit(30)) : [];
    const reports = [];
    for (let i = 0; i < runs.length; i += 5) reports.push(...await Promise.all(runs.slice(i, i + 5).map(reportForRun)));
    const actions = runs.length ? dataOrThrow(await supabaseAdmin.from('management_actions').select('*').eq('admin_id', a.userId).in('batch_id', runs.map(run => run.id)).order('due_date')) : [];
    return json({ company: organizations[0]?.name || null, reports, actions, historyLimit: 30 });
  } catch (e) { return failure(e); }
}
