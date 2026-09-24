import type { Metadata } from "next";
import { OfflineApp } from "@/components/offline-app";

export const metadata: Metadata = { title: "Без интернет" };

// Тази страница се пази в телефона и се показва, когато няма интернет.
// Данните идват от последния запазен списък на телефона.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-10">
      <OfflineApp />
    </main>
  );
}
