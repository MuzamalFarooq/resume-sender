import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";
import { templateCreateSchema } from "@/lib/validation";

export async function GET() {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const templates = await getPrisma().emailTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess({ templates });
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const input = await readJson(request, templateCreateSchema);
    const template = await getPrisma().emailTemplate.create({
      data: { ...input, userId },
    });

    return apiSuccess({ template }, 201);
  });
}
