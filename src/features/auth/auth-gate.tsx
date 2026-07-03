"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-client";
import { LoginForm } from "./login-form";

// Gates the app behind sign-in. Offline-first: any cached session counts —
// even one whose access token has expired and can't refresh without network —
// so the app always opens offline after the first online sign-in.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        setState(session ? "signed-in" : "signed-out");
      },
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "loading") {
    return <div className="h-screen w-screen bg-[var(--frame)]" />;
  }
  if (state === "signed-out") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--frame)]">
        <LoginForm />
      </div>
    );
  }
  return <>{children}</>;
}
