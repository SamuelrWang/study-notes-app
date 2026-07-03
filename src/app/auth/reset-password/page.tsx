"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

// Set a new password after following a reset email (the recovery session is
// already live — /auth/callback exchanged it before redirecting here).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/");
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--frame)]">
      <form onSubmit={submit} className="w-full max-w-[336px]" style={{ animation: "loginFadeIn 0.6s ease-out both" }}>
        <h2 className="text-[24px] font-bold tracking-[-0.5px] text-[#181818]">Set a new password</h2>
        {error && (
          <div className="mt-4 rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-[14px] text-red-700">
            {error}
          </div>
        )}
        <div className="auth-field-3d mt-6 flex h-[46px] items-center rounded-[10px] px-[16px]">
          <input
            type="password"
            autoFocus
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-[14px] text-[#181818] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="auth-btn-3d mt-5 flex h-[46px] w-full items-center justify-center rounded-[10px] text-[15px] font-semibold text-white"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
