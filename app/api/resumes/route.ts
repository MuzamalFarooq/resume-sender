import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, withApiErrors } from "@/lib/api/response";
import { enforceResumeRateLimit } from "@/lib/api/rate-limit";
import { createResumeRecord } from "@/lib/resumes/default";
import { decodeResumeFileName, MAX_RESUME_FILE_SIZE_BYTES, validateResumePdf } from "@/lib/resumes/pdf";
import { getPrisma } from "@/lib/prisma";
import {
  deleteResumeObject,
  getConfiguredResumeSizeLimit,
  putResumeObject,
} from "@/lib/storage/resume-storage";

export const runtime = "nodejs";

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

async function readCappedBody(request: Request, maxFileSizeBytes: number) {
  if (!request.body) {
    throw new ApiError(400, "EMPTY_FILE", "Choose a PDF file to upload.");
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxFileSizeBytes || total > MAX_RESUME_FILE_SIZE_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "FILE_TOO_LARGE", "PDF files must be 5 MB or smaller.");
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

export async function GET() {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-list", 120, 60_000);
    const resumes = await getPrisma().resume.findMany({
      where: { userId },
      select: resumeSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return apiSuccess({ resumes });
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-upload", 10, 60 * 60_000);

    const fileName = decodeResumeFileName(request.headers.get("x-resume-file-name"));
    const contentType = request.headers.get("content-type");
    if (contentType?.split(";")[0].trim().toLowerCase() !== "application/pdf") {
      throw new ApiError(400, "INVALID_MIME_TYPE", "The file must be declared as a PDF.");
    }

    const maxFileSizeBytes = getConfiguredResumeSizeLimit();
    const contentLength = request.headers.get("content-length");
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxFileSizeBytes)) {
      throw new ApiError(413, "FILE_TOO_LARGE", "PDF files must be 5 MB or smaller.");
    }

    const bytes = await readCappedBody(request, maxFileSizeBytes);
    validateResumePdf(fileName, contentType, bytes, maxFileSizeBytes);

    const storageKey = `users/${encodeURIComponent(userId)}/resumes/${randomUUID()}.pdf`;
    const prisma = getPrisma();
    try {
      await putResumeObject(storageKey, bytes);
      const resume = await createResumeRecord(prisma, {
        userId,
        displayName: fileName,
        fileName,
        contentType: "application/pdf",
        sizeBytes: bytes.length,
        storageKey,
      });

      return apiSuccess({ resume }, 201);
    } catch (error) {
      try {
        await deleteResumeObject(storageKey);
      } catch (cleanupError) {
        console.error(
          "Resume upload storage cleanup failed:",
          cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        );
        throw new ApiError(
          503,
          "UPLOAD_CLEANUP_FAILED",
          "The upload could not be saved and cleanup is pending. Please try again later.",
        );
      }

      throw error;
    }
  });
}
