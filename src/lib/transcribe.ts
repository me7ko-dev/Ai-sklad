import "server-only";

// Превръща гласов запис в текст с OpenAI (разбира български).
const DEFAULT_MODEL = "gpt-4o-transcribe";

export class TranscribeError extends Error {}

export async function transcribe(audio: Blob, fileName: string, productNames: string[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TranscribeError("Липсва OPENAI_API_KEY — гласът още не е настроен.");
  }
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";

  const form = new FormData();
  form.append("file", audio, fileName);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL);
  form.append("language", "bg");
  form.append("response_format", "json");
  // Имената на продуктите помагат да се чуят правилно.
  form.append(
    "prompt",
    `Продажби и доставки в малък магазин. Продукти: ${productNames.join(", ")}`.slice(0, 800),
  );

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error("OpenAI:", error);
    throw new TranscribeError("Няма връзка с услугата за разпознаване на глас. Опитайте пак.");
  }

  if (!response.ok) {
    console.error("OpenAI:", response.status, await response.text().catch(() => ""));
    if (response.status === 401) throw new TranscribeError("Ключът OPENAI_API_KEY не е валиден.");
    if (response.status === 429) {
      throw new TranscribeError("OpenAI отказа: няма заредени пари или има твърде много заявки.");
    }
    throw new TranscribeError("Гласът не можа да се разпознае. Опитайте пак.");
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}
