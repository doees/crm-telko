import { spawnSync } from "node:child_process";
for (const name of ["FINANCE_DATABASE_URL", "SCM_DATABASE_URL"]) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "services/prisma/schema.prisma",
    ],
    { stdio: "inherit", env: { ...process.env, SERVICE_DATABASE_URL: value } },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
