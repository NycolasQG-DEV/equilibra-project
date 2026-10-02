import { NextRequest } from "next/server";
import { admin, body, failure, json, HttpError, rate } from "@/lib/security";
import { dashboard } from "@/lib/management/service";
import { insights } from "@/lib/management/insights";
export async function POST(r: NextRequest) {
  try {
    const a = await admin(r),
      b = await body(r);
    await rate("insight:" + a.userId, 12, 3600);
    const d = await dashboard(a.userId),
      batch = d.batches.find((x) => x.id === b.batchId);
    if (!batch) throw new HttpError(404, "Campanha indisponível.");
    return json(await insights(batch));
  } catch (e) {
    return failure(e);
  }
}
