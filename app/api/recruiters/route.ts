import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";
import { recruiterCreateSchema } from "@/lib/validation";

export async function GET() {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const recruiters = await getPrisma().recruiter.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ recruiters });
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const input = await readJson(request, recruiterCreateSchema);
    const recruiter = await getPrisma().recruiter.create({
      data: { ...input, userId },
    });

    return apiSuccess({ recruiter }, 201);
  });
}
