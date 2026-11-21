import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getPrisma: vi.fn(),
  enforceResumeRateLimit: vi.fn(),
  createResumeRecord: vi.fn(),
  setDefaultResume: vi.fn(),
  createResumeDownloadUrl: vi.fn(),
  putResumeObject: vi.fn(),
  deleteResumeObject: vi.fn(),
  readResumeObject: vi.fn(),
  resume: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  campaign: { findFirst: vi.fn() },
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    resume: { findFirst: vi.fn() },
    campaign: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/api/auth", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/api/rate-limit", () => ({
  enforceResumeRateLimit: mocks.enforceResumeRateLimit,
}));
vi.mock("@/lib/resumes/default", () => ({
  createResumeRecord: mocks.createResumeRecord,
  setDefaultResume: mocks.setDefaultResume,
}));
vi.mock("@/lib/storage/resume-storage", () => ({
  StorageConfigurationError: class StorageConfigurationError extends Error {},
  StorageOperationError: class StorageOperationError extends Error {},
  createResumeDownloadUrl: mocks.createResumeDownloadUrl,
  deleteResumeObject: mocks.deleteResumeObject,
  putResumeObject: mocks.putResumeObject,
  readResumeObject: mocks.readResumeObject,
  getConfiguredResumeSizeLimit: vi.fn(() => 5 * 1024 * 1024),
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: mocks.getPrisma,
  DatabaseConfigurationError: class DatabaseConfigurationError extends Error {},
}));

import * as resumeCollection from "@/app/api/resumes/route";
import * as resumeItem from "@/app/api/resumes/[id]/route";
import * as resumeDefault from "@/app/api/resumes/[id]/default/route";
import * as resumeDownload from "@/app/api/resumes/[id]/download/route";

const resume = {
  id: "resume-a",
  displayName: "Engineering resume",
  fileName: "resume.pdf",
  contentType: "application/pdf",
  sizeBytes: 100,
  isDefault: true,
  status: "READY",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue("user-a");
  mocks.enforceResumeRateLimit.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.getPrisma.mockReturnValue({
    resume: mocks.resume,
    campaign: mocks.campaign,
    $transaction: mocks.transaction,
  });
});

describe("resume API ownership", () => {
  it("requires authentication before accepting an upload", async () => {
    mocks.requireUserId.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Sign in."));

    const response = await resumeCollection.POST(
      new Request("http://localhost/api/resumes", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.putResumeObject).not.toHaveBeenCalled();
  });

  it("stores a validated PDF and removes the object if the database write fails", async () => {
    const bytes = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF");
    const request = () =>
      new Request("http://localhost/api/resumes", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Resume-File-Name": encodeURIComponent("resume.pdf"),
        },
        body: bytes,
      });

    mocks.putResumeObject.mockResolvedValue(undefined);
    mocks.createResumeRecord.mockResolvedValue(resume);
    const success = await resumeCollection.POST(request());
    expect(success.status).toBe(201);
    expect(mocks.putResumeObject).toHaveBeenCalledWith(expect.stringMatching(/users\/user-a\/resumes\/.+\.pdf$/), bytes);

    mocks.createResumeRecord.mockRejectedValue(new Error("Database write failed."));
    mocks.deleteResumeObject.mockResolvedValue(undefined);
    const failure = await resumeCollection.POST(request());
    expect(failure.status).toBe(500);
    expect(mocks.deleteResumeObject).toHaveBeenCalled();
  });

  it("lists resumes only for the authenticated user", async () => {
    mocks.resume.findMany.mockResolvedValue([resume]);

    const response = await resumeCollection.GET();

    expect(response.status).toBe(200);
    expect(mocks.resume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
    expect((await response.json()).data.resumes).toHaveLength(1);
  });

  it("hides another user's resume from metadata, rename, delete, and download operations", async () => {
    mocks.resume.findFirst.mockResolvedValue(null);
    mocks.resume.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.$queryRaw.mockResolvedValue([]);

    const metadataResponse = await resumeItem.GET(new Request("http://localhost"), routeContext("resume-b"));
    const renameResponse = await resumeItem.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Changed name" }),
      }),
      routeContext("resume-b"),
    );
    const deleteResponse = await resumeItem.DELETE(new Request("http://localhost"), routeContext("resume-b"));
    const downloadResponse = await resumeDownload.GET(
      new Request("http://localhost"),
      routeContext("resume-b"),
    );

    expect(metadataResponse.status).toBe(404);
    expect(renameResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(downloadResponse.status).toBe(404);
    expect(mocks.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "resume-b", userId: "user-a" } }),
    );
    expect(mocks.resume.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "resume-b", userId: "user-a", status: "READY" } }),
    );
    expect(mocks.readResumeObject).not.toHaveBeenCalled();
    expect(mocks.createResumeDownloadUrl).not.toHaveBeenCalled();
  });

  it("refuses deletion while an active campaign references the resume", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([{ id: resume.id }]);
    mocks.tx.resume.findFirst.mockResolvedValue(resume);
    mocks.tx.campaign.findFirst.mockResolvedValue({ id: "campaign-a" });

    const response = await resumeItem.DELETE(
      new Request("http://localhost"),
      routeContext(resume.id),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("RESUME_IN_USE");
    expect(mocks.readResumeObject).not.toHaveBeenCalled();
    expect(mocks.deleteResumeObject).not.toHaveBeenCalled();
  });

  it("sets the default using the authenticated owner ID and never returns storage details", async () => {
    mocks.setDefaultResume.mockResolvedValue(resume);

    const response = await resumeDefault.POST(
      new Request("http://localhost", { method: "POST" }),
      routeContext("resume-a"),
    );

    expect(response.status).toBe(200);
    expect(mocks.setDefaultResume).toHaveBeenCalledWith(
      expect.anything(),
      "user-a",
      "resume-a",
    );
    expect((await response.json()).data.resume).toEqual({
      ...resume,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
    });
  });
});
