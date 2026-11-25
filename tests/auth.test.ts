import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persistGoogleIdentity: vi.fn(),
}));

vi.mock("@/lib/auth/google-account", () => ({
  persistGoogleIdentity: mocks.persistGoogleIdentity,
}));

import type { Account, Profile, User } from "next-auth";
import { authOptions, getSafeCallbackUrl } from "@/lib/auth";

function googleSignInInput(emailVerified: boolean) {
  const user: User = {
    id: "google-user-id",
    name: "New User",
    email: "New.User@example.com",
    image: "https://example.com/avatar.png",
  };
  const account: Account = {
    provider: "google",
    providerAccountId: "google-user-id",
    type: "oauth",
  };
  const profile: Profile & { email_verified: boolean; picture: string } = {
    sub: "google-user-id",
    email: "New.User@example.com",
    email_verified: emailVerified,
    name: "New User",
    picture: "https://example.com/avatar.png",
  };

  return { user, account, profile };
}

async function runSignIn(input: ReturnType<typeof googleSignInInput>) {
  const callback = authOptions.callbacks?.signIn;
  if (!callback) {
    throw new Error("The sign-in callback is not configured.");
  }

  return callback(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.persistGoogleIdentity.mockResolvedValue("database-user-id");
});

describe("Google sign-in", () => {
  it("persists verified Google identities using a normalized email", async () => {
    const input = googleSignInInput(true);

    await expect(runSignIn(input)).resolves.toBe(true);

    expect(mocks.persistGoogleIdentity).toHaveBeenCalledWith({
      email: "new.user@example.com",
      providerAccountId: "google-user-id",
      name: "New User",
      image: "https://example.com/avatar.png",
    });
    expect(input.user.id).toBe("database-user-id");
  });

  it("rejects unverified or mismatched Google emails without creating an account", async () => {
    const unverified = googleSignInInput(false);
    await expect(runSignIn(unverified)).resolves.toBe(false);

    const mismatched = googleSignInInput(true);
    mismatched.profile.email = "someone-else@example.com";
    await expect(runSignIn(mismatched)).resolves.toBe(false);

    expect(mocks.persistGoogleIdentity).not.toHaveBeenCalled();
  });
});

describe("sign-in callback URL validation", () => {
  it("preserves safe internal destinations", () => {
    expect(getSafeCallbackUrl("/dashboard?section=overview#top")).toBe(
      "/dashboard?section=overview#top",
    );
  });

  it.each([
    undefined,
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/dashboard\nhttps://attacker.example",
  ])("falls back to the dashboard for unsafe destinations", (destination) => {
    expect(getSafeCallbackUrl(destination)).toBe("/dashboard");
  });
});
