import { NextResponse } from "next/server";
import { DIMENSIONS, PROTOCOL_VERSION } from "@/lib/ai/protocol";
export async function GET() {
  return NextResponse.json({
    protocolVersion: PROTOCOL_VERSION,
    dimensions: DIMENSIONS.map(({ id, name, question }) => ({
      id,
      name,
      question,
    })),
    instrument:
      "Instrumento próprio de percepção, sem validação psicométrica declarada.",
  });
}
