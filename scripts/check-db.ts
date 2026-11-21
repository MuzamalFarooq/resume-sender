import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in the process environment.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connectivity verified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.message === "DATABASE_URL is not set in the process environment.") {
    console.error(error.message);
  } else {
    console.error(
      "Database connectivity check failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  process.exitCode = 1;
});
