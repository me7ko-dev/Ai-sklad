import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { syncOffline, type SyncResult } from "@/lib/sync";

// Приема записите, направени на телефона без интернет.
// Отделен адрес (а не сървърно действие), за да работи и от запазената офлайн страница.
export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Не сте влезли." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { items?: unknown };
  const result = await syncOffline(body.items);
  if (result.sent.length > 0) revalidatePath("/", "layout");
  return NextResponse.json<SyncResult>(result);
}
