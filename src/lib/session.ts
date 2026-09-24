import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "./auth";

// Всяко действие, което променя данни, проверява входа отново,
// защото сървърните действия могат да се извикат и извън екрана.
export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();
  if (!(await isValidToken(cookieStore.get(AUTH_COOKIE)?.value))) {
    throw new Error("Не сте влезли. Отворете приложението отново.");
  }
}
