import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";
import { templateImportSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const { templates } = await readJson(request, templateImportSchema);
    const result = await getPrisma().emailTemplate.createMany({
      data: templates.map((template) => ({ ...template, userId })),
      skipDuplicates: true,
    });

    return apiSuccess({
      imported: result.count,
      skipped: templates.length - result.count,
    }, 201);
  });
}
