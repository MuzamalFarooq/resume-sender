import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, withApiErrors } from "@/lib/api/response";
import { enforceResumeRateLimit } from "@/lib/api/rate-limit";
import { setDefaultResume } from "@/lib/resumes/default";
import { getPrisma } from "@/lib/prisma";
import { resumeIdSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    await enforceResumeRateLimit(userId, "resume-mutation", 30, 60_000);
    const { id: rawId } = await params;
    const id = resumeIdSchema.parse(rawId);
    const resume = await setDefaultResume(getPrisma(), userId, id);

    return apiSuccess({ resume });
  });
}
