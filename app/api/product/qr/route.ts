import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(r: NextRequest) {
  const token = r.nextUrl.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return new NextResponse(null, { status: 400 });
  const url = new URL(`/responder/${token}`, process.env.APP_URL || r.nextUrl.origin).toString();
  const png = await QRCode.toBuffer(url, { type: "png", width: 360, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
