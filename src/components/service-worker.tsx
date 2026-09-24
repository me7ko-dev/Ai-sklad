"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Обновява запазената страница „Без интернет“ с текущата версия.
        if (navigator.onLine) registration.active?.postMessage("refresh-offline");
      })
      .catch(() => {});
  }, []);
  return null;
}
