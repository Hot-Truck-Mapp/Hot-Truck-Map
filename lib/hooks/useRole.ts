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
    const fetchRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!mountedRef.current) return;
        if (!user) { setRole(null); return; }

        // Admin: still sourced from metadata (set server-side only, not user-editable via normal flows)
        if (user.user_metadata?.role === "admin") { setRole("admin"); return; }

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
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchRole();
    return () => { mountedRef.current = false; };
  }, []);

  return {
    role,
    loading,
    isCustomer: role === "customer",
    isOperator: role === "operator",
    isAdmin: role === "admin",
  };
}
