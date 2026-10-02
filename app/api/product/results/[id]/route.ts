import { NextRequest } from 'next/server';
import { admin, failure, json } from '@/lib/security';
import { ownedRun } from '@/lib/product/surveys';
import { reportForRun } from '@/lib/product/report';
export async function GET(r: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const a = await admin(r);
    return json(await reportForRun(await ownedRun(a.userId, (await context.params).id)));
  } catch (e) { return failure(e); }
}
