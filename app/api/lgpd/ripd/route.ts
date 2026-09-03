import { NextResponse } from "next/server";
import { getRipdReport } from "@/lib/ai/storage-mysql";

export async function GET() {
  return NextResponse.json(getRipdReport());
}
