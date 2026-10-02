import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import {
  admin,
  body,
  failure,
  json,
  HttpError,
  textField,
  rate,
} from "@/lib/security";
import { getPool, query } from "@/lib/db";
import { PROTOCOL_VERSION } from "@/lib/ai/protocol";

export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    const rows = await query(
      `SELECT l.id, l.title, l.sector, l.role, l.batch_id, l.active, l.used, l.created_at,
              b.title AS batch_title, b.sector AS batch_sector, b.color AS batch_color,
              b.closed_at AS batch_closed
       FROM survey_links l
       LEFT JOIN management_batches b ON b.id = l.batch_id
       WHERE l.admin_id = ?
       ORDER BY l.created_at DESC`,
      [a.userId],
    );
    return json(
      rows.map((l) => ({
        id: l.id,
        title: l.title,
        sector: l.sector,
        role: l.role,
        batchId: l.batch_id,
        batchTitle: l.batch_title,
        batchSector: l.batch_sector,
        batchColor: l.batch_color || "#6366f1",
        active: !!l.active,
        used: !!l.used,
        createdAt: l.created_at,
        batchClosed: !!l.batch_closed,
      })),
    );
  } catch (e) {
    return failure(e);
  }
}

export async function POST(r: NextRequest) {
  try {
    const a = await admin(r),
      b = await body(r);
    await rate("links:" + a.userId, 10, 3600);
    const title = textField(b.title, 3, 120, "Titulo"),
      sector = textField(b.sector || "Geral", 2, 100, "Setor"),
      context = textField(b.context, 30, 4000, "Contexto");
    const qty = Number(b.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 200)
      throw new HttpError(400, "Quantidade deve estar entre 1 e 200.");
    const rawColor = typeof b.color === "string" ? b.color.trim() : "#6366f1";
    const color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : "#6366f1";

    const batchId = "bat_" + randomBytes(18).toString("base64url"),
      c = await getPool().getConnection();
    try {
      await c.beginTransaction();
      const [users]: any = await c.execute(
        "SELECT max_colaboradores FROM users WHERE id=? FOR UPDATE",
        [a.userId],
      );
      const [counts]: any = await c.execute(
        'SELECT COUNT(*) count FROM survey_links WHERE admin_id=? AND created_at>=DATE_FORMAT(NOW(), "%Y-%m-01")',
        [a.userId],
      );
      if (Number(counts[0].count) + qty > Number(users[0].max_colaboradores))
        throw new HttpError(403, "A quantidade excede a cota mensal de links do plano.");
      await c.execute(
        "INSERT INTO management_batches(id,admin_id,title,sector,context,protocol_version,color) VALUES (?,?,?,?,?,?,?)",
        [batchId, a.userId, title, sector, context, PROTOCOL_VERSION, color],
      );
      const links = [];
      for (let i = 0; i < qty; i++) {
        const id = "lnk_" + randomBytes(24).toString("base64url");
        await c.execute(
          "INSERT INTO survey_links(id,title,sector,admin_id,batch_id) VALUES (?,?,?,?,?)",
          [id, title, sector, a.userId, batchId],
        );
        links.push({ id, title, sector, batchId, batchColor: color, active: true, used: false });
      }
      await c.commit();
      return json({ success: true, batchId, links, count: qty });
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
