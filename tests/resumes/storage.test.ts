import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("private resume storage signing", () => {
  it("creates a short-lived signed PDF URL using the configured lifetime", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "aws");
    vi.stubEnv("STORAGE_REGION", "us-east-1");
    vi.stubEnv("STORAGE_BUCKET", "private-resumes");
    vi.stubEnv("STORAGE_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("STORAGE_SIGNED_URL_TTL_SECONDS", "120");

    const { createResumeDownloadUrl } = await import("@/lib/storage/resume-storage");
    const result = await createResumeDownloadUrl(
      "users/user-a/resumes/generated-key.pdf",
      "resume.pdf",
      "inline",
    );

    expect(result.expiresIn).toBe(120);
    expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("120");
  });
});
