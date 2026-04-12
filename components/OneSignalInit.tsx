"use client";

import { useEffect } from "react";

/**
 * Initialises OneSignal web push once on mount.
 * Must be a client component — rendered inside the root layout.
 */
export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    import("react-onesignal").then(({ default: OneSignal }) => {
      OneSignal.init({
        appId,
        // Don't show the built-in bell widget — we have our own follow button UX
        notifyButton: { enable: false },
        // Allow testing on localhost without HTTPS
        allowLocalhostAsSecureOrigin: true,
      }).catch(() => {
        // Silently ignore init failures (e.g. blocked by browser extensions)
      });
    });
  }, []);

  return null;
}
