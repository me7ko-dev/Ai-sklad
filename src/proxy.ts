import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { missingEnv } from "@/lib/env";

// Пуска само хора, въвели верния ПИН. Останалите отиват на екрана за вход.
export async function proxy(request: NextRequest) {
  // Без настройки нека страницата сама покаже какво липсва.
  if (missingEnv().length > 0) return NextResponse.next();

  const loggedIn = await isValidToken(request.cookies.get(AUTH_COOKIE)?.value);
  const onLogin = request.nextUrl.pathname === "/vhod";

  if (!loggedIn && !onLogin) {
    return NextResponse.redirect(new URL("/vhod", request.url));
  }
  if (loggedIn && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Иконите, манифестът и офлайн страницата трябва да са достъпни и без вход.
  matcher: [
    "/((?!_next/static|_next/image|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|icon-192.png|icon-512.png).*)",
  ],
};
