import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, readJson, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";
import { recruiterImportSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const { recruiters } = await readJson(request, recruiterImportSchema);
    const result = await getPrisma().recruiter.createMany({
      data: recruiters.map((recruiter) => ({ ...recruiter, userId })),
      skipDuplicates: true,
    });

    return apiSuccess({
      imported: result.count,
      skipped: recruiters.length - result.count,
    }, 201);
  });
}
