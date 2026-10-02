import { NextRequest } from "next/server";
import { admin, failure, json } from "@/lib/security";
import { query } from "@/lib/db";
export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    return json(
      await query(
        "SELECT action,target_id,created_at FROM audit_logs WHERE performed_by=? ORDER BY created_at DESC LIMIT 200",
        [a.userId],
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
