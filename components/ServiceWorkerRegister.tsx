"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production so the app meets PWA install criteria. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore registration errors (e.g. localhost HTTP quirks) */
    });
  }, []);

  return null;
}
