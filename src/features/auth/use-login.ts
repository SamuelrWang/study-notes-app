"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";

// Sign-in state machine for the login form. Email/password only — confirms
// are off (no SMTP), so sign-up takes effect immediately. Magic-link and
// password-reset emails land on /auth/callback.
type Pending = null | "password" | "signup" | "magic" | "reset";

const callbackUrl = () => `${window.location.origin}/auth/callback`;

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [signInFailed, setSignInFailed] = useState(false);

  const supabase = getSupabase();

  async function run(kind: Pending, fn: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setPending(kind);
    try {
      await fn();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (kind === "password") setSignInFailed(true);
    } finally {
      setPending(null);
    }
  }

  const signInWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    return run("password", async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // the auth gate flips on the SIGNED_IN event
    });
  };

  const signUpWithPassword = () =>
    run("signup", async () => {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    });

  const sendMagicLink = () =>
    run("magic", async () => {
      if (!email) throw new Error("Enter your email first.");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      setMessage("Check your email for a sign-in link.");
    });

  const resetPassword = () =>
    run("reset", async () => {
      if (!email) throw new Error("Enter your email first, then click Forgot password.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${callbackUrl()}?next=/auth/reset-password`,
      });
      if (error) throw error;
      setMessage("Check your email to reset your password.");
    });

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    message,
    pending,
    signInFailed,
    signInWithPassword,
    signUpWithPassword,
    sendMagicLink,
    resetPassword,
  };
}
