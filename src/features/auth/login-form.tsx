"use client";

import { useState } from "react";
import { useLogin } from "./use-login";

// Sign-in form (ported from the Dopl login, minus the glass panel column):
// Study Notes brand, email/password with sign-up, and a magic-link fallback.
// Centered on the app's frame background by the auth gate.
export function LoginForm() {
  const {
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
  } = useLogin();

  const [showPassword, setShowPassword] = useState(false);
  const busy = pending !== null;
  const isSignup = mode === "signup";

  return (
    <div className="w-full max-w-[336px]" style={{ animation: "loginFadeIn 0.6s ease-out both" }}>
      {/* Brand */}
      <div className="flex flex-col items-start gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon_io/android-chrome-192x192.png"
          alt="Study Notes"
          className="auth-logo-3d h-9 w-9 rounded-[8px]"
        />
        <span className="text-[21px] font-semibold tracking-tight text-[#181818]">
          Study Notes
        </span>
      </div>

      <h2 className="mt-7 text-[30px] font-bold leading-none tracking-[-0.8px] text-[#181818]">
        {isSignup ? "Create your account" : "Sign in"}
      </h2>

      {(error || message) && (
        <div
          className={`mt-6 rounded-[10px] border px-4 py-3 text-[14px] ${
            error
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-[#cfd8e3] bg-[#eef3fa] text-[#1f3a5f]"
          }`}
          role="status"
        >
          {error ?? message}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="mt-7">
          <label htmlFor="login-email" className="mb-2 block text-[14px] font-medium text-[#181818]">
            Email Address
          </label>
          <div className="auth-field-3d flex h-[46px] items-center gap-2.5 rounded-[10px] px-[16px]">
            <MailIcon />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#181818] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="login-password" className="mb-2 block text-[14px] font-medium text-[#181818]">
            Password
          </label>
          <div className="auth-field-3d flex h-[46px] items-center gap-2.5 rounded-[10px] px-[16px]">
            <LockIcon />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#181818] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="cursor-pointer text-[#9a9a9a] transition-colors hover:text-[#181818]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {!isSignup && signInFailed && (
            <button
              type="button"
              onClick={resetPassword}
              disabled={busy}
              className="mt-2 cursor-pointer text-[13px] text-[#181818] hover:underline disabled:opacity-60"
            >
              {pending === "reset" ? "Sending reset link…" : "Forgot password?"}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="auth-btn-3d mt-7 flex h-[46px] w-full cursor-pointer items-center justify-center rounded-[10px] text-[15px] font-semibold text-white"
        >
          {isSignup
            ? pending === "signup"
              ? "Creating…"
              : "Sign up"
            : pending === "password"
              ? "Signing in…"
              : "Sign in"}
        </button>
      </form>

      <div className="mt-5 leading-[1.55]">
        <p className="text-[14px] text-[#9a9a9a]">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "signin" : "signup")}
            disabled={busy}
            className="cursor-pointer font-medium text-[#181818] hover:underline disabled:opacity-60"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>

      {!isSignup && (
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={busy}
          className="mt-2 block cursor-pointer text-[13px] text-[#9a9a9a] hover:text-[#181818] hover:underline disabled:opacity-60"
        >
          {pending === "magic" ? "Sending link…" : "Email me a sign-in link instead"}
        </button>
      )}

      <p className="mt-7 text-[12px] leading-relaxed text-[#9a9a9a]">
        Sign in once online — after that, Study Notes works fully offline.
      </p>
    </div>
  );
}

function MailIcon() {
  return (
    <svg className="h-[18px] w-[18px] flex-none text-[#181818]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-[18px] w-[18px] flex-none text-[#181818]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m3 3 18 18" />}
    </svg>
  );
}

