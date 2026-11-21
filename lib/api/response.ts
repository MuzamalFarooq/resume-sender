import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "@/lib/api/errors";
import { DatabaseConfigurationError } from "@/lib/prisma";
import { StorageConfigurationError, StorageOperationError } from "@/lib/storage/resume-storage";

export { ApiError } from "@/lib/api/errors";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function readJson<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<ReturnType<S["parse"]>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  return schema.parse(value) as ReturnType<S["parse"]>;
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function withApiErrors(
  handler: () => Promise<Response>,
) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      const response = NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
      if (error.status === 429) {
        response.headers.set("Retry-After", String(error.retryAfterSeconds ?? 60));
      }
      return response;
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the submitted fields and try again.",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    if (hasPrismaCode(error, "P2002")) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_RECORD", message: "A record with those details already exists." } },
        { status: 409 },
      );
    }

    if (hasPrismaCode(error, "P2025")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "The requested record was not found." } },
        { status: 404 },
      );
    }

    if (
      error instanceof DatabaseConfigurationError ||
      (error instanceof Error && error.name === "PrismaClientInitializationError") ||
      ["P1001", "P1002", "P1008", "P1017"].some((code) => hasPrismaCode(error, code))
    ) {
      return NextResponse.json(
        { error: { code: "DATABASE_UNAVAILABLE", message: "The database is not available." } },
        { status: 503 },
      );
    }

    if (error instanceof StorageConfigurationError) {
      return NextResponse.json(
        { error: { code: "STORAGE_NOT_CONFIGURED", message: "Private resume storage is not configured." } },
        { status: 503 },
      );
    }

    if (error instanceof StorageOperationError) {
      return NextResponse.json(
        { error: { code: "STORAGE_UNAVAILABLE", message: "Private resume storage is temporarily unavailable." } },
        { status: 503 },
      );
    }

    console.error("API request failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } },
      { status: 500 },
    );
  }
}
