import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const database = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<string>) => callback(transaction),
    ),
  };

  return {
    transaction,
    database,
    getPrisma: vi.fn(() => database),
  };
});

vi.mock("@/lib/prisma", () => ({
  getPrisma: mocks.getPrisma,
}));

import { persistGoogleIdentity } from "@/lib/auth/google-account";

const identity = {
  email: "person@example.com",
  providerAccountId: "google-123",
  name: "Google Name",
  image: "https://example.com/avatar.png",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPrisma.mockReturnValue(mocks.database);
  mocks.database.$transaction.mockImplementation(async (callback) => callback(mocks.transaction));
  mocks.transaction.oAuthAccount.findUnique.mockResolvedValue(null);
  mocks.transaction.oAuthAccount.create.mockResolvedValue({ id: "account-1" });
  mocks.transaction.user.findMany.mockResolvedValue([]);
  mocks.transaction.user.create.mockResolvedValue({ id: "new-user" });
  mocks.transaction.user.update.mockResolvedValue({ id: "existing-user" });
});

describe("persistGoogleIdentity", () => {
  it("creates a user and its Google identity atomically for a first sign-in", async () => {
    await expect(persistGoogleIdentity(identity)).resolves.toBe("new-user");

    expect(mocks.transaction.user.create).toHaveBeenCalledWith({
      data: {
        email: "person@example.com",
        emailVerified: expect.any(Date),
        name: "Google Name",
        image: "https://example.com/avatar.png",
        oauthAccounts: {
          create: {
            provider: "google",
            providerAccountId: "google-123",
          },
        },
      },
      select: { id: true },
    });
    expect(mocks.transaction.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it("reuses linked Google identities without overwriting user information", async () => {
    mocks.transaction.oAuthAccount.findUnique.mockResolvedValue({ userId: "existing-user" });

    await expect(persistGoogleIdentity(identity)).resolves.toBe("existing-user");

    expect(mocks.transaction.user.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });

  it("retries a concurrent unique-key conflict and reuses the winning account", async () => {
    const conflict = Object.assign(new Error("Unique constraint conflict."), { code: "P2002" });
    mocks.database.$transaction.mockImplementationOnce(async () => {
      throw conflict;
    });
    mocks.transaction.oAuthAccount.findUnique.mockResolvedValue({ userId: "winning-user" });

    await expect(persistGoogleIdentity(identity)).resolves.toBe("winning-user");

    expect(mocks.database.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
  });

  it("links only a verified Google email to an existing user and preserves their profile", async () => {
    mocks.transaction.user.findMany.mockResolvedValue([
      { id: "existing-user", emailVerified: null },
    ]);

    await expect(persistGoogleIdentity(identity)).resolves.toBe("existing-user");

    expect(mocks.transaction.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        userId: "existing-user",
        provider: "google",
        providerAccountId: "google-123",
      },
    });
    expect(mocks.transaction.user.update).toHaveBeenCalledWith({
      where: { id: "existing-user" },
      data: { emailVerified: expect.any(Date) },
      select: { id: true },
    });
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
  });

  it("fails closed when the same email matches multiple existing users", async () => {
    mocks.transaction.user.findMany.mockResolvedValue([
      { id: "user-1", emailVerified: null },
      { id: "user-2", emailVerified: null },
    ]);

    await expect(persistGoogleIdentity(identity)).rejects.toThrow(
      "Google email matches multiple user records.",
    );
    expect(mocks.transaction.oAuthAccount.create).not.toHaveBeenCalled();
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
  });
});
