"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

// PKCE code exchange landing. Reached three ways: the browser OAuth redirect,
// email links (magic/reset via ?next=), and the desktop deep link (the shell
// converts studynotes://auth-callback?code=… into this route). The verifier
// lives in this window's localStorage, so the exchange must happen here.
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const next = params.get("next") ?? "/";
    if (!code) {
      router.replace("/");
      return;
    }
    getSupabase()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) setError(error.message);
        else router.replace(next);
      });
  }, [params, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--frame)]">
      <p className="text-sm text-[var(--muted)]">
        {error ? `Sign-in failed: ${error}` : "Signing you in…"}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
