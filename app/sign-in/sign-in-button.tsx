"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";

export default function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function continueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const result = await signIn("google", { callbackUrl, redirect: false });
      if (result?.error || !result?.url) {
        setError("Google sign-in could not be started. Please try again.");
        setLoading(false);
      } else {
        window.location.assign(result.url);
      }
    } catch {
      setError("Google sign-in could not be started. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-action">
      <button
        className="button-primary auth-button google-button"
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" /> : <GoogleMark />}
        <span>{loading ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="google-mark">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-2 4.7-4.3 6.1v5h7c4.1-3.8 6.4-9.3 6.4-14.8Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-7-5c-1.9 1.3-4.1 2-6.5 2-5 0-9.3-3.4-10.8-8H6v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M13.2 28.2a12 12 0 0 1 0-8.4v-5.2H6a20 20 0 0 0 0 18.8l7.2-5.2Z" />
      <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.7 29.5 4 24 4A20 20 0 0 0 6 14.6l7.2 5.2c1.5-4.6 5.8-8 10.8-8Z" />
    </svg>
  );
}
