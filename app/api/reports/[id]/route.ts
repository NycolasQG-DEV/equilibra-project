import { NextRequest } from "next/server";
import { failure, json, participant } from "@/lib/security";
import { getReport } from "@/lib/ai/storage-mysql";
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await participant(r, (await params).id);
    return json(
      s.status === "completed" ? await getReport(s.id) : { status: s.status },
    );
  } catch (e) {
    return failure(e);
  }
}
