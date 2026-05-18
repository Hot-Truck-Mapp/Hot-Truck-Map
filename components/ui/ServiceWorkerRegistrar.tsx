"use client";

import { useEffect } from "react";

/**
 * Registers the service worker globally so push notifications and
 * offline support work for all users — not just those who visit /account.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — non-critical, ignore
      });
    }
  }, []);

  return null;
}
