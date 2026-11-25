import { getPrisma } from "@/lib/prisma";

type GoogleIdentity = {
  email: string;
  providerAccountId: string;
  name: string | null;
  image: string | null;
};

function isRetryableIdentityConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export async function persistGoogleIdentity(identity: GoogleIdentity): Promise<string> {
  const prisma = getPrisma();
  const email = identity.email.trim().toLowerCase();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const linkedAccount = await transaction.oAuthAccount.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: identity.providerAccountId,
              },
            },
            select: { userId: true },
          });

          if (linkedAccount) {
            return linkedAccount.userId;
          }

          const matchingUsers = await transaction.user.findMany({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true, emailVerified: true },
            take: 2,
          });

          if (matchingUsers.length > 1) {
            throw new Error("Google email matches multiple user records.");
          }

          const existingUser = matchingUsers[0];
          if (existingUser) {
            await transaction.oAuthAccount.create({
              data: {
                userId: existingUser.id,
                provider: "google",
                providerAccountId: identity.providerAccountId,
              },
            });

            if (!existingUser.emailVerified) {
              await transaction.user.update({
                where: { id: existingUser.id },
                data: { emailVerified: new Date() },
                select: { id: true },
              });
            }

            return existingUser.id;
          }

          const newUser = await transaction.user.create({
            data: {
              email,
              emailVerified: new Date(),
              name: identity.name?.trim() || null,
              image: identity.image,
              oauthAccounts: {
                create: {
                  provider: "google",
                  providerAccountId: identity.providerAccountId,
                },
              },
            },
            select: { id: true },
          });

          return newUser.id;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (!isRetryableIdentityConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Unable to resolve Google account.");
}
