"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5 text-center">
      <h1 className="text-3xl font-bold">Нещо се обърка</h1>
      <p className="text-xl">Проверете интернета и опитайте пак.</p>
      <button onClick={reset} className="btn btn-primary">
        Опитай пак
      </button>
      <Link href="/" className="btn btn-secondary">
        Към наличностите
      </Link>
    </main>
  );
}
