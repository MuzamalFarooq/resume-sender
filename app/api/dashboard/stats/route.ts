import { requireUserId } from "@/lib/api/auth";
import { apiSuccess, withApiErrors } from "@/lib/api/response";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  return withApiErrors(async () => {
    const userId = await requireUserId();
    const prisma = getPrisma();
    const [recruiters, templates, resumes, connectedGmailAccounts, campaigns] = await Promise.all([
      prisma.recruiter.count({ where: { userId } }),
      prisma.emailTemplate.count({ where: { userId } }),
      prisma.resume.count({ where: { userId, status: { not: "ARCHIVED" } } }),
      prisma.gmailAccount.count({ where: { userId, status: "CONNECTED" } }),
      prisma.campaign.count({ where: { userId } }),
    ]);

    return apiSuccess({
      recruiters,
      templates,
      resumes,
      connectedGmailAccounts,
      campaigns,
    });
  });
}
