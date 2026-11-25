"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInButton() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function continueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const result = await signIn("google", { callbackUrl: "/dashboard", redirect: false });
      if (result?.error) {
        setError("Sign in is unavailable. Check the Google OAuth configuration and try again.");
      } else if (result?.url) {
        window.location.assign(result.url);
      }
    } catch {
      setError("Sign in could not be started. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-action">
      <button className="button-primary auth-button" onClick={continueWithGoogle} disabled={loading}>
        {loading ? "Connecting…" : "Continue with Google"}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
