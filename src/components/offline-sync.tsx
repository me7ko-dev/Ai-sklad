"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushQueue, useQueue, type FlushResult } from "@/lib/offline-queue";

// Изпраща записите, направени без интернет, щом връзката се върне,
// и показва колко още чакат.
export function OfflineSync() {
  const queue = useQueue();
  const router = useRouter();
  const [sent, setSent] = useState(0);
  const [rejected, setRejected] = useState<FlushResult["rejected"]>([]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function run() {
      const result = await flushQueue();
      if (!result) return;
      if (result.sent > 0) {
        setSent(result.sent);
        router.refresh();
        clearTimeout(timeout);
        timeout = setTimeout(() => setSent(0), 6000);
      }
      if (result.rejected.length > 0) setRejected((current) => [...current, ...result.rejected]);
    }

    void run();
    window.addEventListener("online", run);
    const interval = setInterval(run, 30_000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router, queue.length]);

  if (queue.length === 0 && sent === 0 && rejected.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 p-2" aria-live="polite">
      {queue.length > 0 && (
        <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-center text-xl font-semibold text-amber-900">
          ⏳ {queue.length === 1 ? "1 запис чака" : `${queue.length} записа чакат`} интернет
        </p>
      )}
      {sent > 0 && (
        <p className="alert-success text-center">
          ✓ Изпратени {sent === 1 ? "1 запис" : `${sent} записа`}, направени без интернет
        </p>
      )}
      {rejected.length > 0 && (
        <div className="alert-error flex flex-col gap-2">
          <p>Тези записи без интернет не можаха да се запишат:</p>
          <ul className="list-disc pl-6 text-lg">
            {rejected.map((item, index) => (
              <li key={index}>
                {item.name}: {item.reason}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRejected([])} className="btn btn-secondary min-h-12 text-xl">
            Разбрах
          </button>
        </div>
      )}
    </div>
  );
}
