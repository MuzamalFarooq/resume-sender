import { ApiError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { enforceResumeRateLimit } from "@/lib/api/rate-limit";
import { getPrisma } from "@/lib/prisma";
import {
  deleteResumeObject,
  readResumeObject,
  putResumeObject,
} from "@/lib/storage/resume-storage";
import { resumeIdSchema, resumeRenameSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

const resumeSelect = {
  id: true,
  displayName: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  isDefault: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-metadata", 120, 60_000);
    const { id: rawId } = await params;
    const id = resumeIdSchema.parse(rawId);
    const resume = await getPrisma().resume.findFirst({
      where: { id, userId },
      select: resumeSelect,
    });

    if (!resume) {
      throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
    }

    return apiSuccess({ resume });
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-mutation", 30, 60_000);
    const { id: rawId } = await params;
    const id = resumeIdSchema.parse(rawId);
    const { displayName } = await readJson(request, resumeRenameSchema);
    const result = await getPrisma().resume.updateMany({
      where: { id, userId, status: "READY" },
      data: { displayName },
    });

    if (result.count === 0) {
      throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
    }

    const resume = await getPrisma().resume.findFirst({
      where: { id, userId },
      select: resumeSelect,
    });

    return apiSuccess({ resume });
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-mutation", 30, 60_000);
    const { id: rawId } = await params;
    const id = resumeIdSchema.parse(rawId);
    const prisma = getPrisma();
    let backup: Buffer | undefined;
    let deletionStarted = false;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`resume-default:${userId}`}, 0))`;
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Resume"
          WHERE "id" = ${id} AND "userId" = ${userId}
          FOR UPDATE
        `;
        if (!locked.length) {
          throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
        }

        const resume = await tx.resume.findFirst({ where: { id, userId } });
        if (!resume) {
          throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
        }

        const activeCampaign = await tx.campaign.findFirst({
          where: {
            userId,
            resumeId: id,
            status: { in: ["DRAFT", "QUEUED", "SENDING", "PAUSED"] },
          },
          select: { id: true },
        });
        if (activeCampaign) {
          throw new ApiError(
            409,
            "RESUME_IN_USE",
            "This resume is attached to an active campaign and cannot be deleted yet.",
          );
        }

        backup = await readResumeObject(resume.storageKey);
        deletionStarted = true;
        await deleteResumeObject(resume.storageKey);
        await tx.resume.delete({ where: { id } });

        if (resume.isDefault) {
          const nextDefault = await tx.resume.findFirst({
            where: { userId, status: "READY" },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          if (nextDefault) {
            await tx.resume.update({
              where: { id: nextDefault.id },
              data: { isDefault: true, defaultSlot: "default" },
            });
          }
        }
      }, { timeout: 15_000 });
    } catch (error) {
      if (deletionStarted && backup) {
        try {
          const resume = await prisma.resume.findFirst({ where: { id, userId } });
          if (resume) {
            await putResumeObject(resume.storageKey, backup);
          }
        } catch (restoreError) {
          console.error(
            "Resume deletion storage recovery failed:",
            restoreError instanceof Error ? restoreError.name : "UnknownError",
          );
          throw new ApiError(
            503,
            "DELETE_RECOVERY_FAILED",
            "The resume could not be safely deleted. Please contact support before retrying.",
          );
        }
      }
      throw error;
    }

    return apiSuccess({ deleted: true });
  });
}
