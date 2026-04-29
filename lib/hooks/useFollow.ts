"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFollow(truckId: string, initialFollowing = false) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    if (following) {
      await supabase.from("follows").delete().eq("user_id", user.id).eq("truck_id", truckId);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ user_id: user.id, truck_id: truckId });
      setFollowing(true);
    }
    setLoading(false);
  }

  return { following, loading, toggle };
}
