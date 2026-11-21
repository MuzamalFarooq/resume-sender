import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getPrisma: vi.fn(),
  recruiter: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  },
  emailTemplate: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  },
  resume: { count: vi.fn() },
  gmailAccount: { count: vi.fn() },
  campaign: { count: vi.fn() },
}));

vi.mock("@/lib/api/auth", () => ({
  requireUserId: mocks.requireUserId,
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: mocks.getPrisma,
  DatabaseConfigurationError: class DatabaseConfigurationError extends Error {},
}));
vi.mock("@/lib/storage/resume-storage", () => ({
  StorageConfigurationError: class StorageConfigurationError extends Error {},
  StorageOperationError: class StorageOperationError extends Error {},
}));

import * as recruiterCollection from "@/app/api/recruiters/route";
import * as recruiterItem from "@/app/api/recruiters/[id]/route";
import * as recruiterImport from "@/app/api/recruiters/import/route";
import * as templateCollection from "@/app/api/templates/route";
import * as templateItem from "@/app/api/templates/[id]/route";
import * as templateImport from "@/app/api/templates/import/route";
import * as dashboardStats from "@/app/api/dashboard/stats/route";
import { ApiError } from "@/lib/api/response";

const recruiter = {
  id: "rec-1",
  userId: "user-a",
  name: "Alex Morgan",
  email: "alex@example.com",
  company: "Example",
  jobTitle: "Recruiter",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const template = {
  id: "tpl-1",
  userId: "user-a",
  name: "Intro",
  subject: "Hello",
  body: "Dear {{recruiter_name}}",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/test", {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseJson(response: Response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue("user-a");
  mocks.getPrisma.mockReturnValue({
    recruiter: mocks.recruiter,
    emailTemplate: mocks.emailTemplate,
    resume: mocks.resume,
    gmailAccount: mocks.gmailAccount,
    campaign: mocks.campaign,
  });
});

describe("recruiter API", () => {
  it("lists only the authenticated user's contacts", async () => {
    mocks.recruiter.findMany.mockResolvedValue([recruiter]);

    const response = await recruiterCollection.GET();

    expect(response.status).toBe(200);
    expect(mocks.recruiter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
    expect((await responseJson(response)).data.recruiters).toHaveLength(1);
  });

  it("normalizes email addresses and assigns ownership server-side", async () => {
    mocks.recruiter.create.mockResolvedValue(recruiter);

    const response = await recruiterCollection.POST(jsonRequest("POST", {
      name: "Alex Morgan",
      email: "  ALEX@Example.com ",
      company: "Example",
      userId: "user-b",
    }));

    expect(response.status).toBe(400);
    expect(mocks.recruiter.create).not.toHaveBeenCalled();

    const validResponse = await recruiterCollection.POST(jsonRequest("POST", {
      name: "Alex Morgan",
      email: "  ALEX@Example.com ",
      company: "Example",
    }));

    expect(validResponse.status).toBe(201);
    expect(mocks.recruiter.create).toHaveBeenCalledWith({
      data: {
        name: "Alex Morgan",
        email: "alex@example.com",
        company: "Example",
        jobTitle: "",
        userId: "user-a",
      },
    });
  });

  it("rejects duplicate email records", async () => {
    mocks.recruiter.create.mockRejectedValue({ code: "P2002" });

    const response = await recruiterCollection.POST(jsonRequest("POST", {
      name: "Alex Morgan",
      email: "alex@example.com",
    }));

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error.code).toBe("DUPLICATE_RECORD");
  });

  it("scopes updates and deletes to the authenticated user", async () => {
    mocks.recruiter.updateMany.mockResolvedValue({ count: 1 });
    mocks.recruiter.findFirst.mockResolvedValue(recruiter);
    const params = Promise.resolve({ id: "rec-1" });

    const updateResponse = await recruiterItem.PATCH(
      jsonRequest("PATCH", { company: "Updated" }),
      { params },
    );
    expect(updateResponse.status).toBe(200);
    expect(mocks.recruiter.updateMany).toHaveBeenCalledWith({
      where: { id: "rec-1", userId: "user-a" },
      data: { company: "Updated" },
    });

    mocks.recruiter.deleteMany.mockResolvedValue({ count: 0 });
    const deleteResponse = await recruiterItem.DELETE(jsonRequest("DELETE"), { params });
    expect(deleteResponse.status).toBe(404);
    expect(mocks.recruiter.deleteMany).toHaveBeenCalledWith({
      where: { id: "rec-1", userId: "user-a" },
    });
  });

  it("uses duplicate-safe bulk import", async () => {
    mocks.recruiter.createMany.mockResolvedValue({ count: 1 });

    const response = await recruiterImport.POST(jsonRequest("POST", {
      recruiters: [
        { name: "Alex Morgan", email: " ALEX@EXAMPLE.COM " },
        { name: "Alex Morgan", email: "alex@example.com" },
      ],
    }));

    expect(response.status).toBe(201);
    expect(mocks.recruiter.createMany).toHaveBeenCalledWith({
      data: [
        { name: "Alex Morgan", email: "alex@example.com", company: "", jobTitle: "", userId: "user-a" },
        { name: "Alex Morgan", email: "alex@example.com", company: "", jobTitle: "", userId: "user-a" },
      ],
      skipDuplicates: true,
    });
    expect((await responseJson(response)).data).toEqual({ imported: 1, skipped: 1 });
  });

  it("returns unauthorized responses without an authenticated session", async () => {
    mocks.requireUserId.mockRejectedValue(
      new ApiError(401, "UNAUTHORIZED", "Sign in to access this resource."),
    );

    const response = await recruiterCollection.GET();

    expect(response.status).toBe(401);
    expect(mocks.recruiter.findMany).not.toHaveBeenCalled();
  });
});

describe("email template API", () => {
  it("supports create, user-scoped update/delete, and duplicate-safe import", async () => {
    mocks.emailTemplate.create.mockResolvedValue(template);
    const createResponse = await templateCollection.POST(jsonRequest("POST", {
      name: "Intro",
      subject: "Hello",
      body: "Dear {{recruiter_name}}",
    }));
    expect(createResponse.status).toBe(201);
    expect(mocks.emailTemplate.create).toHaveBeenCalledWith({
      data: {
        name: "Intro",
        subject: "Hello",
        body: "Dear {{recruiter_name}}",
        userId: "user-a",
      },
    });

    mocks.emailTemplate.updateMany.mockResolvedValue({ count: 1 });
    mocks.emailTemplate.findFirst.mockResolvedValue(template);
    const params = Promise.resolve({ id: "tpl-1" });
    expect((await templateItem.PATCH(jsonRequest("PATCH", { subject: "Updated" }), { params })).status).toBe(200);
    expect(mocks.emailTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: "tpl-1", userId: "user-a" },
      data: { subject: "Updated" },
    });

    mocks.emailTemplate.deleteMany.mockResolvedValue({ count: 1 });
    expect((await templateItem.DELETE(jsonRequest("DELETE"), { params })).status).toBe(200);
    expect(mocks.emailTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: "tpl-1", userId: "user-a" },
    });

    mocks.emailTemplate.createMany.mockResolvedValue({ count: 1 });
    const importResponse = await templateImport.POST(jsonRequest("POST", {
      templates: [{ name: "Intro", subject: "Hello", body: "Hello" }],
    }));
    expect(importResponse.status).toBe(201);
    expect(mocks.emailTemplate.createMany).toHaveBeenCalledWith({
      data: [{ name: "Intro", subject: "Hello", body: "Hello", userId: "user-a" }],
      skipDuplicates: true,
    });
  });

  it("lists only the authenticated user's templates", async () => {
    mocks.emailTemplate.findMany.mockResolvedValue([template]);

    const response = await templateCollection.GET();

    expect(response.status).toBe(200);
    expect(mocks.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
    expect((await responseJson(response)).data.templates).toHaveLength(1);
  });

  it("rejects invalid fields with a consistent validation response", async () => {
    const response = await templateCollection.POST(jsonRequest("POST", {
      name: " ",
      subject: "",
      body: "",
    }));

    expect(response.status).toBe(400);
    expect((await responseJson(response)).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.emailTemplate.create).not.toHaveBeenCalled();
  });
});

describe("dashboard stats API", () => {
  it("counts only data owned by the authenticated user", async () => {
    mocks.recruiter.count.mockResolvedValue(2);
    mocks.emailTemplate.count.mockResolvedValue(3);
    mocks.resume.count.mockResolvedValue(1);
    mocks.gmailAccount.count.mockResolvedValue(0);
    mocks.campaign.count.mockResolvedValue(4);

    const response = await dashboardStats.GET();

    expect(response.status).toBe(200);
    expect(mocks.recruiter.count).toHaveBeenCalledWith({ where: { userId: "user-a" } });
    expect(mocks.emailTemplate.count).toHaveBeenCalledWith({ where: { userId: "user-a" } });
    expect((await responseJson(response)).data).toEqual({
      recruiters: 2,
      templates: 3,
      resumes: 1,
      connectedGmailAccounts: 0,
      campaigns: 4,
    });
  });
});
