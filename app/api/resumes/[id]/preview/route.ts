import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/api/auth";
import { withApiErrors } from "@/lib/api/response";
import { enforceResumeRateLimit } from "@/lib/api/rate-limit";
import { createResumeDownloadUrl } from "@/lib/storage/resume-storage";
import { getPrisma } from "@/lib/prisma";
import { resumeIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-file-access", 120, 5 * 60_000);
    const { id: rawId } = await params;
    const id = resumeIdSchema.parse(rawId);
    const resume = await getPrisma().resume.findFirst({
      where: { id, userId, status: "READY" },
      select: { storageKey: true, fileName: true },
    });

    if (!resume) {
      throw new ApiError(404, "NOT_FOUND", "The requested resume was not found.");
    }

    const { url } = await createResumeDownloadUrl(resume.storageKey, resume.fileName, "inline");
    const response = NextResponse.redirect(url, { status: 302 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  });
}
