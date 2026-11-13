import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let prismaClient: PrismaClient | undefined = globalForPrisma.prisma;

// Lazy creation keeps mock dashboard/build independent of database credentials.
export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL belum diatur. Isi .env dengan koneksi PostgreSQL lokal.",
    );
  }
  prismaClient ??= new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;
  return prismaClient;
}
