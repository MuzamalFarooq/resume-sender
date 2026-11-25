import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { authOptions, getSafeCallbackUrl } from "@/lib/auth";
import SignInButton from "./sign-in-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const { error, callbackUrl } = await searchParams;
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);
  const errorMessage = getSignInErrorMessage(error);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>resume<span className="brand-light">sender</span></span>
        </Link>
        <div className="auth-copy">
          <h1 id="sign-in-title">Your search, in one place.</h1>
          <p>Sign in to securely access your recruiter contacts and email templates.</p>
        </div>
        <SignInButton callbackUrl={safeCallbackUrl} />
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
        <p className="auth-privacy">Your workspace is private to your account.</p>
      </section>
    </main>
  );
}

function getSignInErrorMessage(error?: string): string | null {
  if (!error) {
    return null;
  }

  if (error === "AccessDenied") {
    return "Google sign-in was cancelled or the account email could not be verified.";
  }

  if (error === "Configuration") {
    return "Google sign-in is not configured. Please contact the site administrator.";
  }

  if (error === "OAuthAccountNotLinked") {
    return "This Google account could not be linked safely. Please contact support.";
  }

  return "Google sign-in could not be completed. Please try again.";
}
