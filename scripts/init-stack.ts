import { spawnSync } from "node:child_process";
import { db } from "../src/server/db";
async function main() {
  for (const args of [
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    ["scripts/migrate-services.mjs"],
  ]) {
    const result = spawnSync(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) throw new Error("Database migration failed");
  }
  if (
    (await db().user.count({ where: { role: "ADMIN", isActive: true } })) === 0
  ) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/bootstrap-admin.ts"],
      { stdio: "inherit", env: process.env },
    );
    if (result.status !== 0) throw new Error("Administrator bootstrap failed");
  } else
    console.log(
      "Existing administrator retained. Bootstrap credentials did not overwrite any account.",
    );
}
main()
  .catch(() => {
    console.error("Stack initialization failed; application was not started.");
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
