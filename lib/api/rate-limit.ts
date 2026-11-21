import { ApiError } from "@/lib/api/errors";
import { getPrisma } from "@/lib/prisma";

export async function enforceResumeRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const counter = await getPrisma().resumeRateLimit.upsert({
    where: {
      userId_bucket_windowStart: { userId, bucket, windowStart },
    },
    create: { userId, bucket, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  if (counter.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
    throw new ApiError(429, "RATE_LIMITED", "Too many resume requests. Please try again later.", retryAfter);
  }
}
