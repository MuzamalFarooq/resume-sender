import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("The database connection is not configured.");
    this.name = "DatabaseConfigurationError";
  }
}

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseConfigurationError();
  }

  const global = globalThis as PrismaGlobal;
  if (!global.prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    global.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return global.prisma;
}
