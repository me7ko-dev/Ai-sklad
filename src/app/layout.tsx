import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineSync } from "@/components/offline-sync";
import { SetupNeeded } from "@/components/setup-needed";
import { ServiceWorker } from "@/components/service-worker";
import { missingEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Гласов склад", template: "%s · Гласов склад" },
  description: "Наличности в магазина, водени с глас.",
  appleWebApp: { capable: true, title: "Склад", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Всички страници се показват с най-новите данни, никога от кеш.
  await connection();
  const missing = missingEnv();

  return (
    <html lang="bg" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {missing.length > 0 ? (
          <SetupNeeded missing={missing} />
        ) : (
          <>
            <OfflineSync />
            {children}
            <BottomNav />
          </>
        )}
        <ServiceWorker />
      </body>
    </html>
  );
}
