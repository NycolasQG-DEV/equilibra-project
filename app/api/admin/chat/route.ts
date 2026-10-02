import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  admin,
  body,
  failure,
  json,
  HttpError,
  textField,
  rate,
} from "@/lib/security";
import { query, execute } from "@/lib/db";
import { dashboard } from "@/lib/management/service";
import { managerAnswer } from "@/lib/management/insights";
export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    return json({
      history: await query(
        "SELECT id,role,text,created_at FROM admin_chat_messages WHERE admin_id=? ORDER BY created_at ASC LIMIT 100",
        [a.userId],
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    const a = await admin(r),
      b = await body(r);
    if (b.role && b.role !== "user")
      throw new HttpError(
        400,
        "O servidor é responsável pelas respostas da assistente.",
      );
    const question = textField(b.text, 2, 1200, "Pergunta");
    await rate("chat:" + a.userId, 20, 3600);
    const d = await dashboard(a.userId),
      result = await managerAnswer(question, d.batches, d.actions),
      id = randomUUID();
    await execute(
      "INSERT INTO admin_chat_messages(id,admin_id,role,text) VALUES(?,?,'user',?),(?,?,'ai',?)",
      [randomUUID(), a.userId, question, id, a.userId, result.text],
    );
    return json({ success: true, id, ...result });
  } catch (e) {
    return failure(e);
  }
}
