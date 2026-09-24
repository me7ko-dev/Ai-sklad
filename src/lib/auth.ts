// Прост вход с ПИН код. След верен ПИН браузърът пази бисквитка с подпис,
// който не разкрива самия ПИН. Смяна на ПИН-а изхвърля всички стари входове.
export const AUTH_COOKIE = "sklad_vhod";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 180; // 180 дни

export async function authToken(): Promise<string | null> {
  const pin = process.env.APP_PIN?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!pin || !secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`glasov-sklad:${pin}`),
  );
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidToken(value: string | undefined): Promise<boolean> {
  const expected = await authToken();
  return !!expected && value === expected;
}
