import { ApiError } from "@/lib/api/errors";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type PrismaTransaction = Prisma.TransactionClient;

const resumeMetadataSelect = {
  id: true,
  displayName: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  isDefault: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResumeSelect;

export async function lockResumeDefaults(tx: PrismaTransaction, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`resume-default:${userId}`}, 0))`;
}

export async function createResumeRecord(
  prisma: PrismaClient,
  data: {
    userId: string;
    displayName: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await lockResumeDefaults(tx, data.userId);
    const existingDefault = await tx.resume.findFirst({
      where: { userId: data.userId, isDefault: true },
      select: { id: true },
    });

    return tx.resume.create({
      data: {
        ...data,
        status: "READY",
        isDefault: !existingDefault,
        defaultSlot: existingDefault ? null : "default",
      },
      select: resumeMetadataSelect,
    });
  });
}

export async function setDefaultResume(prisma: PrismaClient, userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await lockResumeDefaults(tx, userId);
    const target = await tx.resume.findFirst({
      where: { id, userId, status: "READY" },
      select: { id: true },
    });

    if (!target) {
      throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
    }

    await tx.resume.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false, defaultSlot: null },
    });

    await tx.resume.update({
      where: { id: target.id },
      data: { isDefault: true, defaultSlot: "default" },
    });

    return tx.resume.findFirstOrThrow({
      where: { id: target.id, userId },
      select: resumeMetadataSelect,
    });
  });
}
