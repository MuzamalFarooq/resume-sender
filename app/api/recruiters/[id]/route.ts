import { requireUserId } from "@/lib/api/auth";
import { ApiError, apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";
import { recruiterUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = await readJson(request, recruiterUpdateSchema);
    const result = await getPrisma().recruiter.updateMany({
      where: { id, userId },
      data: input,
    });

    if (result.count === 0) {
      throw new ApiError(404, "NOT_FOUND", "The requested record was not found.");
    }

    const recruiter = await getPrisma().recruiter.findFirst({ where: { id, userId } });
    return apiSuccess({ recruiter });
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const result = await getPrisma().recruiter.deleteMany({ where: { id, userId } });

    if (result.count === 0) {
      throw new ApiError(404, "NOT_FOUND", "The requested record was not found.");
    }

    return apiSuccess({ deleted: true });
  });
}
