"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFollow(truckId: string, initialFollowing = false) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  async function toggle() {
    // Prevent double-tap race conditions
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (following) {
        const { error } = await supabase.from("follows").delete().eq("user_id", user.id).eq("truck_id", truckId);
        if (!error) setFollowing(false);
        // On error: leave state as-is (still following) — UI stays correct
      } else {
        const { error } = await supabase.from("follows").insert({ user_id: user.id, truck_id: truckId });
        if (!error) setFollowing(true);
        // On error: leave state as-is (still not following) — UI stays correct
      }
    } catch {
      // Network error — leave state unchanged so UI stays in sync with DB
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  return { following, loading, toggle };
}
