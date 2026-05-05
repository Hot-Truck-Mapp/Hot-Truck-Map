"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "customer" | "operator" | "admin" | null;

export function useRole() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setRole(user ? ((user.user_metadata?.role as Role) ?? "customer") : null);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  return {
    role,
    loading,
    isCustomer: role === "customer",
    isOperator: role === "operator",
    isAdmin: role === "admin",
  };
}
