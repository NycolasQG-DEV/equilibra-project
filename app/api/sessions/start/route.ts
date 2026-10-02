import { NextRequest } from "next/server";
import { start } from "@/lib/ai/participant-service";
import { failure } from "@/lib/security";
export async function POST(r: NextRequest) {
  try {
    return await start(r);
  } catch (e) {
    return failure(e);
  }
}
