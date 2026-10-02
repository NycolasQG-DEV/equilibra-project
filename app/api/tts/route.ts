import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { body, participant, rate, failure, HttpError } from "@/lib/security";
export async function POST(request: NextRequest) {
  let tts: MsEdgeTTS | undefined;
  try {
    const data = await body(request);
    const session = await participant(request, String(data.sessionId || ""));
    await rate("tts:" + session.id, 60);
    if (
      session.status !== "in_progress" ||
      typeof data.text !== "string" ||
      data.text.length < 2 ||
      data.text.length > 800
    )
      throw new HttpError(400, "Narração indisponível.");
    const text = data.text.trim();
    const approved = [
      session.currentStepData?.bot_statement,
      session.currentStepData?.next_question,
    ]
      .filter(Boolean)
      .join(" ");
    if (!approved.includes(text) || /[<>]/.test(text))
      throw new HttpError(400, "Apenas a pergunta atual pode ser narrada.");
    tts = new MsEdgeTTS();
    const engine = tts;
    const audio = await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        engine.close();
        reject(new Error("Voice timeout"));
      }, 10000);
      engine
        .setMetadata(
          "pt-BR-FranciscaNeural",
          OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
        )
        .then(() => {
          const { audioStream } = engine.toStream(text);
          const chunks: Buffer[] = [];
          let size = 0;
          audioStream.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1500000) {
              clearTimeout(timer);
              engine.close();
              reject(new Error("Voice limit"));
              return;
            }
            chunks.push(chunk);
          });
          audioStream.on("end", () => {
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
          });
          audioStream.on("error", () => {
            clearTimeout(timer);
            reject(new Error("Voice unavailable"));
          });
        })
        .catch(() => {
          clearTimeout(timer);
          reject(new Error("Voice unavailable"));
        });
    });
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  } finally {
    tts?.close();
  }
}
