"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";
import { seedFirstDataIfEmpty } from "./seed-first-data";

// Sign-in state machine for the login form. Email/password only. The form has
// two modes — "signup" (default) and "signin". Magic-link and password-reset
// emails land on /auth/callback.
type Pending = null | "password" | "signup" | "magic" | "reset";
type Mode = "signup" | "signin";

const callbackUrl = () => `${window.location.origin}/auth/callback`;

export function useLogin() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [signInFailed, setSignInFailed] = useState(false);

  const supabase = getSupabase();

  // Switching views must never submit or carry stale error/message state.
  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setSignInFailed(false);
  };

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

  const signInWithPassword = () =>
    run("password", async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // the auth gate flips on the SIGNED_IN event
    });

  const signUpWithPassword = () =>
    run("signup", async () => {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // Supabase surfaces an already-registered email either via this code or
        // (with obfuscation on) via a user with no identities — point them to sign in.
        if (/already registered|already been registered/i.test(error.message)) {
          throw new Error("That email is already registered. Try signing in instead.");
        }
        throw error;
      }

      // Obfuscated duplicate: no session, and the returned user has no identities.
      if (!data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error("That email is already registered. Try signing in instead.");
      }

      if (data.session) {
        // Confirm-email is OFF: signUp already established a session. The auth
        // gate flips on the SIGNED_IN event. Seed first data before it does, so
        // a brand-new user lands on a note instead of an empty screen.
        await seedFirstDataIfEmpty();
        return;
      }

      // Confirm-email is ON: no session yet — the user must click the emailed link.
      setMessage("Check your email to confirm your account.");
    });

  // The form's single submit routes to the action for the current mode; the
  // secondary controls (switchers, magic-link, forgot-password) are type="button".
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    return mode === "signup" ? signUpWithPassword() : signInWithPassword();
  };

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
    mode,
    switchMode,
    email,
    setEmail,
    password,
    setPassword,
    error,
    message,
    pending,
    signInFailed,
    onSubmit,
    sendMagicLink,
    resetPassword,
  };
}
