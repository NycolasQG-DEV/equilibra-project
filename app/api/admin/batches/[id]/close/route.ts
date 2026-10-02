import { NextRequest } from "next/server";
import { admin, sameOrigin, failure, json, HttpError } from "@/lib/security";
import { getPool } from "@/lib/db";
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await admin(r);
    sameOrigin(r);
    const id = (await params).id,
      c = await getPool().getConnection();
    try {
      await c.beginTransaction();
      const [rows]: any = await c.execute(
        "SELECT id FROM management_batches WHERE id=? AND admin_id=? FOR UPDATE",
        [id, a.userId],
      );
      if (!rows.length) throw new HttpError(404, "Campanha indisponível.");
      await c.execute(
        "UPDATE management_batches SET closed_at=COALESCE(closed_at,NOW()) WHERE id=?",
        [id],
      );
      await c.execute(
        "UPDATE survey_links SET active=0 WHERE batch_id=? AND admin_id=?",
        [id, a.userId],
      );
      await c.commit();
      return json({ success: true });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    return failure(e);
  }
}
