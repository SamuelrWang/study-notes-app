"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

// In-app replacements for window.prompt/confirm, styled like the rest of the
// UI. (Electron doesn't support prompt() at all, and the system dialogs look
// foreign anyway.) Call uiPrompt()/uiConfirm() from anywhere; <DialogHost/>
// (mounted once in the page) renders the active dialog.

type PromptRequest = {
  kind: "prompt";
  title: string;
  defaultValue: string;
  confirmText: string;
  resolve: (value: string | null) => void;
};

type ConfirmRequest = {
  kind: "confirm";
  title: string;
  message?: string;
  confirmText: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

type DialogRequest = PromptRequest | ConfirmRequest;

let listener: ((req: DialogRequest) => void) | null = null;

export function uiPrompt(
  title: string,
  defaultValue = "",
  confirmText = "Save",
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) return resolve(null);
    listener({ kind: "prompt", title, defaultValue, confirmText, resolve });
  });
}

export function uiConfirm(
  title: string,
  options: { message?: string; confirmText?: string; danger?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(false);
    listener({
      kind: "confirm",
      title,
      message: options.message,
      confirmText: options.confirmText ?? "Delete",
      danger: options.danger ?? true,
      resolve,
    });
  });
}

const EXIT_MS = 160;

export function DialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listener = (req) => {
      setRequest(req);
      setValue(req.kind === "prompt" ? req.defaultValue : "");
    };
    return () => {
      listener = null;
    };
  }, []);

  // enter transition via forced reflow (same pattern as the settings modal)
  useEffect(() => {
    if (!request) return;
    panelRef.current?.getBoundingClientRect();
    setShown(true);
    if (request.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [request]);

  const close = (result: string | null | boolean) => {
    if (!request) return;
    if (request.kind === "prompt") request.resolve(result as string | null);
    else request.resolve(result as boolean);
    setShown(false);
    setTimeout(() => setRequest(null), EXIT_MS);
  };

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(request.kind === "prompt" ? null : false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  return (
    <div
      onClick={() => close(request.kind === "prompt" ? null : false)}
      className={clsx(
        "modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6",
        shown && "shown",
      )}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "modal-panel w-[380px] max-w-[92vw] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl",
          shown && "shown",
        )}
      >
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
          {request.title}
        </h3>

        {request.kind === "prompt" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close(value);
            }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="concave-field mt-3 w-full rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none"
            />
          </form>
        )}

        {request.kind === "confirm" && request.message && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{request.message}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => close(request.kind === "prompt" ? null : false)}
            className="btn-light rounded-lg px-3.5 py-1.5 text-sm font-medium text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            onClick={() => close(request.kind === "prompt" ? value : true)}
            className={clsx(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white",
              request.kind === "confirm" && request.danger
                ? "border border-red-800 bg-gradient-to-b from-red-500 to-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_3px_rgba(0,0,0,0.2)]"
                : "raised-black",
            )}
          >
            {request.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
