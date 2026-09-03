import { NextResponse } from "next/server";
import { getDpoInfo } from "@/lib/ai/storage-mysql";

export async function GET() {
  return NextResponse.json(getDpoInfo());
}
