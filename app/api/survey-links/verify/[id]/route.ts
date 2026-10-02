import { NextRequest } from "next/server";
import { queryOne, initDatabase } from "@/lib/db";
import { failure, json } from "@/lib/security";
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await initDatabase();
    const l = await queryOne(
      "SELECT l.id,l.title,l.sector,l.active,l.used,b.closed_at FROM survey_links l JOIN management_batches b ON b.id=l.batch_id WHERE l.id=?",
      [(await params).id],
    );
    if (!l || !l.active || l.used || l.closed_at)
      return json(
        { error: "Link indisponível. Solicite uma campanha nova ao gestor." },
        404,
      );
    return json({
      valid: true,
      link: { id: l.id, title: l.title, sector: l.sector },
      privacyContact: process.env.PRIVACY_CONTACT || null,
    });
  } catch (e) {
    return failure(e);
  }
}
