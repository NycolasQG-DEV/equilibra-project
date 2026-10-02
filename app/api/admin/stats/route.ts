import { NextRequest } from "next/server";
import { admin, failure, json } from "@/lib/security";
import { dashboard } from "@/lib/management/service";
export async function GET(r: NextRequest) {
  try {
    const a = await admin(r);
    return json(await dashboard(a.userId));
  } catch (e) {
    return failure(e);
  }
}
