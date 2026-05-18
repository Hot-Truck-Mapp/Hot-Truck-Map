import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use INITIAL_SESSION to initialise state — eliminates the race condition
    // that arises when getSession() and onAuthStateChange() fire independently.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        // INITIAL_SESSION fires once synchronously with the current session on
        // subscription, so we can safely clear the loading flag here.
        if (event === 'INITIAL_SESSION') setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
