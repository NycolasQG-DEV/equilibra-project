import { NextRequest } from "next/server";
import { admin, sameOrigin, failure, json, HttpError } from "@/lib/security";
import { execute } from "@/lib/db";
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await admin(r);
    sameOrigin(r);
    const result = await execute(
      "UPDATE survey_links l JOIN management_batches b ON b.id=l.batch_id SET l.active=NOT l.active WHERE l.id=? AND l.admin_id=? AND l.used=0 AND b.closed_at IS NULL",
      [(await params).id, a.userId],
    );
    if (!result.rowCount) throw new HttpError(404, "Link indisponível.");
    return json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
