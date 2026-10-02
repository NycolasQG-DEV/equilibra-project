import { NextRequest } from "next/server";
import { answer } from "@/lib/ai/participant-service";
import { failure } from "@/lib/security";
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await answer(r, (await params).id);
  } catch (e) {
    return failure(e);
  }
}
