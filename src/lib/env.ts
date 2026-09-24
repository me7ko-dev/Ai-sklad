// Настройките, които приложението чете от средата (Vercel → Environment Variables).
export const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PIN"] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}
