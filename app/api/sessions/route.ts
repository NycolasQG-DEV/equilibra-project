import { NextRequest } from "next/server";
import { admin, failure, json } from "@/lib/security";
export async function GET(r: NextRequest) {
  try {
    await admin(r);
    return json(
      {
        error:
          "Conversas individuais não estão disponíveis ao gestor. Consulte o painel coletivo.",
      },
      410,
    );
  } catch (e) {
    return failure(e);
  }
}
