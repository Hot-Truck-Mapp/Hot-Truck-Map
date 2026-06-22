"use client";

import { useState, useEffect, useCallback } from "react";

export type PushPermission = "default" | "granted" | "denied";

export interface UsePushSubscriptionReturn {
  supported: boolean;
  permission: PushPermission;
  subscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  // Detect support and check current state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setSupported(true);
    setPermission(Notification.permission as PushPermission);

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setSubscribed(true);
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return;
    }

    // Register service worker (idempotent — browser deduplicates)
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Request permission
    const perm = await Notification.requestPermission();
    setPermission(perm as PushPermission);
    if (perm !== "granted") return;

    // Create push subscription
    const pushSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = pushSub.toJSON();
    const body = {
      platform: "web",
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh ?? null,
      auth_key: json.keys?.auth ?? null,
    };

    // Include the session token so the server can identify the user even when
    // cookies are not present (e.g., cross-site contexts or Safari ITP)
    const subscribeHeaders: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const { createClient: makeClient } = await import("@/lib/supabase/client");
      const { data: sessionData } = await makeClient().auth.getSession();
      if (sessionData.session?.access_token) {
        subscribeHeaders["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }
    } catch { /* proceed without token — cookie auth will be used */ }

    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: subscribeHeaders,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSubscribed(true);
    } else {
      // Clean up the browser-side subscription if the server couldn't save it
      await pushSub.unsubscribe();
      throw new Error("Failed to save push subscription");
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;

    const reg = await navigator.serviceWorker.ready;
    const pushSub = await reg.pushManager.getSubscription();
    if (!pushSub) {
      setSubscribed(false);
      return;
    }

    const endpoint = pushSub.endpoint;
    await pushSub.unsubscribe();

    // Include the session token so the server can identify the user even when
    // cookies are not sent (e.g., cross-site contexts or Safari ITP)
    const deleteHeaders: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const { createClient: makeClient } = await import("@/lib/supabase/client");
      const { data: sessionData } = await makeClient().auth.getSession();
      if (sessionData.session?.access_token) {
        deleteHeaders["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }
    } catch { /* proceed without token — cookie auth will be used */ }

    await fetch("/api/push-subscribe", {
      method: "DELETE",
      headers: deleteHeaders,
      body: JSON.stringify({ endpoint }),
    }).catch(() => {}); // Fire-and-forget — browser-side already unsubscribed

    setSubscribed(false);
  }, [supported]);

  return { supported, permission, subscribed, subscribe, unsubscribe };
}
