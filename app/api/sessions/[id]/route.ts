import { NextRequest } from "next/server";
import { failure, json, participant, publicSession } from "@/lib/security";
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return json(publicSession(await participant(r, (await params).id)));
  } catch (e) {
    return failure(e);
  }
}
