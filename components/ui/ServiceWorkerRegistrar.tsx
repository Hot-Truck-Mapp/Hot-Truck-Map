"use client";

import { useEffect } from "react";

/**
 * Registers the service worker globally so push notifications and
 * offline support work for all users — not just those who visit /account.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Reload once when a new SW takes control, so cached assets refresh.
    // Registered synchronously (not inside the .then() below) so the cleanup
    // function returned from this effect actually removes it — a cleanup
    // returned from inside a promise callback is invisible to React and
    // would leak this listener on every unmount.
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

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
    }).catch(() => {
      // SW registration failed — non-critical
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
