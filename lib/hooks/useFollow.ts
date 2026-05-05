"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFollow(truckId: string, initialFollowing = false) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing); // optimistic
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFollowing(wasFollowing); return; }

      const { error } = wasFollowing
        ? await supabase.from("follows").delete().eq("user_id", user.id).eq("truck_id", truckId)
        : await supabase.from("follows").insert({ user_id: user.id, truck_id: truckId });

      if (error) setFollowing(wasFollowing); // rollback on DB error
    } catch {
      setFollowing(wasFollowing); // rollback on network error
    } finally {
      setLoading(false);
    }
  }

  return { following, loading, toggle };
}
