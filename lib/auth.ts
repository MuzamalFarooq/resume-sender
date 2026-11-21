import type { NextAuthOptions, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getPrisma } from "@/lib/prisma";

type GoogleProfile = Profile & { email_verified?: boolean };

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email) {
        return false;
      }

      const googleProfile = profile as GoogleProfile | undefined;
      if (googleProfile?.email_verified !== true) {
        return false;
      }

      const email = user.email.trim().toLowerCase();
      const dbUser = await getPrisma().user.upsert({
        where: { email },
        update: { name: user.name, image: user.image },
        create: {
          email,
          name: user.name,
          image: user.image,
          emailVerified: new Date(),
        },
        select: { id: true },
      });

      user.id = dbUser.id;
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
