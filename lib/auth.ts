import type { NextAuthOptions, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { persistGoogleIdentity } from "@/lib/auth/google-account";

type GoogleProfile = Profile & {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
};

export function getSafeCallbackUrl(value?: string): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/dashboard";
  }

  const destination = new URL(value, "https://resume-sender.invalid");
  if (destination.origin !== "https://resume-sender.invalid") {
    return "/dashboard";
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return "unknown";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "openid email profile" } },
      checks: ["pkce", "state"],
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !account.providerAccountId || !user.email) {
        return false;
      }

      const googleProfile = profile as GoogleProfile | undefined;
      const email = user.email.trim().toLowerCase();
      const profileEmail = googleProfile?.email?.trim().toLowerCase();
      if (
        googleProfile?.email_verified !== true ||
        googleProfile.sub !== account.providerAccountId ||
        !profileEmail ||
        profileEmail !== email
      ) {
        return false;
      }

      try {
        user.id = await persistGoogleIdentity({
          email,
          providerAccountId: account.providerAccountId,
          name: googleProfile.name ?? user.name ?? null,
          image: googleProfile.picture ?? user.image ?? null,
        });
      } catch (error) {
        console.error("Google sign-in account persistence failed", { code: getErrorCode(error) });
        throw new Error("Unable to complete Google sign-in.");
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
