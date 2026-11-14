import { PrismaClient, Prisma } from "@prisma/client";
const globalDb = globalThis as unknown as { crmDb?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (globalDb.crmDb ??= new PrismaClient());
}
export type Tx = Prisma.TransactionClient;
export async function locked<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db().$transaction(
        async (tx) => {
          await tx.workspace.upsert({
            where: { id: "default" },
            create: { id: "default" },
            update: {},
          });
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id='default' FOR UPDATE`;
          return work(tx);
        },
        {
          maxWait: 10000,
          timeout: 20000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 3
      )
        continue;
      throw error;
    }
  }
  throw new Error("Transaction retry exhausted");
}
