import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products";
import { requireAuth } from "@/lib/session";
import { transcribe, TranscribeError } from "@/lib/transcribe";
import { understand, UnderstandError, type Understanding } from "@/lib/understand";

// Разпознаването на глас и AI отнемат няколко секунди.
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1000;

export type VoiceResponse = ({ transcript: string } & Understanding) | { error: string };

function fail(message: string, status = 400) {
  return NextResponse.json<VoiceResponse>({ error: message }, { status });
}

// Приема гласов запис (или написан текст) и връща какво е разбрано.
// Нищо не се записва тук — собственикът първо потвърждава.
export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return fail("Не сте влезли. Отворете приложението отново.", 401);
  }

  try {
    const products = await listProducts();
    let text: string;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof Blob) || audio.size === 0) return fail("Няма запис. Опитайте пак.");
      if (audio.size > MAX_AUDIO_BYTES) return fail("Записът е твърде дълъг. Говорете по-кратко.");
      const fileName = audio instanceof File && audio.name ? audio.name : "zapis.webm";
      text = await transcribe(audio, fileName, products.map((p) => p.name));
    } else {
      const body = (await request.json().catch(() => ({}))) as { text?: unknown };
      text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
    }

    if (!text) {
      return NextResponse.json<VoiceResponse>({
        transcript: "",
        items: [],
        reply: "Не чух нищо. Натиснете бутона и говорете по-близо до телефона.",
      });
    }

    const result = await understand(text, products);
    return NextResponse.json<VoiceResponse>({ transcript: text, ...result });
  } catch (error) {
    if (error instanceof TranscribeError || error instanceof UnderstandError) {
      return fail(error.message, 502);
    }
    const message = error instanceof Error ? error.message : "Нещо се обърка. Опитайте пак.";
    return fail(message, 500);
  }
}
