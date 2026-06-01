"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFollow(truckId: string, initialFollowing = false) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sync when the parent receives server data after initial render
  useEffect(() => {
    if (!inFlightRef.current) setFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = useCallback(async () => {
    // Prevent double-tap race conditions (ref-based, not state-based, to avoid stale closures)
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing); // optimistic update
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mountedRef.current) setFollowing(wasFollowing); return; }

      const { error } = wasFollowing
        ? await supabase.from("follows").delete().eq("user_id", user.id).eq("truck_id", truckId)
        : await supabase.from("follows").insert({ user_id: user.id, truck_id: truckId });

      if (error && mountedRef.current) setFollowing(wasFollowing); // rollback on DB error
    } catch {
      if (mountedRef.current) setFollowing(wasFollowing); // rollback on network error
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, [truckId]); // stable reference — only recreated if truckId changes

  return { following, loading, toggle };
}
