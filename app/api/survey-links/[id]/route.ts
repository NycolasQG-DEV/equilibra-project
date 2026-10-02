import { NextRequest } from "next/server";
import { admin, sameOrigin, failure, json, HttpError } from "@/lib/security";
import { execute } from "@/lib/db";
export async function DELETE(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await admin(r);
    sameOrigin(r);
    const result = await execute(
      "UPDATE survey_links SET active=0 WHERE id=? AND admin_id=? AND used=0",
      [(await params).id, a.userId],
    );
    if (!result.rowCount) throw new HttpError(404, "Link indisponível.");
    return json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
