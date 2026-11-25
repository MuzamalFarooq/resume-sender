import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import SignInButton from "./sign-in-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

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
        <SignInButton />
        {error && <p className="auth-error" role="alert">Sign-in failed. Check the Google OAuth configuration and try again.</p>}
        <p className="auth-privacy">Your workspace is private to your account.</p>
      </section>
    </main>
  );
}
