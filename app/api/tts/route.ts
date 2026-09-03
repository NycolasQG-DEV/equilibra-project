import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Vozes Neurais da Microsoft (Edge TTS) - 100% Gratuitas, Ilimitadas e com Pronúncia Brasileira Ultra-Natural:
// 1. "pt-BR-FranciscaNeural" (Voz feminina profissional, clara, acolhedora e confiável)
// 2. "pt-BR-ThalitaNeural" (Voz feminina suave e natural)
// 3. "pt-BR-AntonioNeural" (Voz masculina profissional)
const DEFAULT_VOICE = "pt-BR-FranciscaNeural";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Texto para sintetização não fornecido." }, { status: 400 });
    }

    const cleanText = text.trim();
    const selectedVoice = voice || DEFAULT_VOICE;

    // 1. Instância do motor Microsoft Edge Neural TTS (Nativo, gratuito e sem custos de API)
    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const streamResult: any = tts.toStream(cleanText);
    const audioStream = streamResult?.audioStream || streamResult;

    // Coleta o stream em buffer MP3
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: any) => reject(err));
    });

    const fullBuffer = Buffer.concat(chunks);
    const uint8 = new Uint8Array(fullBuffer.buffer, fullBuffer.byteOffset, fullBuffer.byteLength);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": fullBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.warn("⚠️ Falha no Edge Neural TTS, tentando fallback rápido:", err?.message);

    // Fallback de emergência (Google TTS caso o WebSocket da Microsoft oscile)
    try {
      const { text } = await req.json().catch(() => ({ text: "" }));
      if (text) {
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.trim())}&tl=pt-BR&total=1&idx=0&textlen=${text.length}&client=tw-ob&prev=input`;
        const gRes = await fetch(googleUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (gRes.ok) {
          const buf = await gRes.arrayBuffer();
          return new NextResponse(buf, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    } catch {}

    return NextResponse.json({ error: "Erro ao sintetizar áudio neural." }, { status: 500 });
  }
}
