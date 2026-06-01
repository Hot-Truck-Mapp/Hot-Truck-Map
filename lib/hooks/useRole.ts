"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "customer" | "operator" | "admin" | null;

export function useRole() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    let fetchInFlight = false;
    const fetchRole = async () => {
      if (fetchInFlight) return; // guard concurrent auth events
      fetchInFlight = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mountedRef.current) return;
        if (!user) { setRole(null); setLoading(false); return; }

        // Admin: sourced from app_metadata which can ONLY be set via the service
        // role key (server-side). user_metadata is user-writable and must never
        // be trusted for privilege escalation.
        if (user.app_metadata?.role === "admin") { setRole("admin"); setLoading(false); return; }

        // Operator: verify via DB truck ownership — user_metadata.role is user-editable
        // and must never be trusted for access control decisions.
        const { data: truck } = await supabase
          .from("trucks")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!mountedRef.current) return;
        setRole(truck ? "operator" : "customer");
      } catch {
        if (mountedRef.current) setRole(null);
      } finally {
        fetchInFlight = false;
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchRole();

    // Re-fetch when the session is established asynchronously (e.g. restored
    // from storage after mount) so the role is never stuck at null post-login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        fetchRole();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    isCustomer: role === "customer",
    isOperator: role === "operator",
    isAdmin: role === "admin",
  };
}
