"use client";

import { useEffect } from "react";

/**
 * Registers the service worker globally so push notifications and
 * offline support work for all users — not just those who visit /account.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // When a new SW is found, tell it to skip waiting and activate immediately
      // so users always get the latest version without closing all tabs.
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // Reload once when the new SW takes control, so cached assets refresh.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });
    }).catch(() => {
      // SW registration failed — non-critical
    });
  }, []);

  return null;
}
