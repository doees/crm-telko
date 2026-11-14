import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
const node = process.execPath;
function command(args, env = process.env) {
  const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", env });
  if (r.status !== 0)
    throw new Error(
      "Command failed: " + args[0] + " " + args.slice(1, 3).join(" "),
    );
}
if (!existsSync(".env.test"))
  command([node, "scripts/setup-env.mjs", "--test"]);
const config = parseEnv(readFileSync(".env.test", "utf8"));
for (const key of [
  "DATABASE_URL",
  "FINANCE_DATABASE_URL",
  "SCM_DATABASE_URL",
]) {
  const u = new URL(config[key]);
  if (
    !u.pathname.endsWith("_test") ||
    !["localhost", "127.0.0.1"].includes(u.hostname)
  )
    throw new Error(
      "Integration tests require isolated local *_test databases.",
    );
}
const env = {
  ...process.env,
  ...config,
  E2E_BASE_URL: config.APP_ORIGIN,
  CI: "true",
};
const container = "nusa-crm-qa-" + Date.now();
const docker = [
  "docker",
  "--host=" + (process.env.CRM_DOCKER_SOCKET ?? "unix:///var/run/docker.sock"),
];
const children = [];
mkdirSync(".qa", { recursive: true });
function service(name, args) {
  const child = spawn(node, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      log += chunk.toString();
      writeFileSync(".qa/" + name + ".log", log, { mode: 0o600 });
    });
  children.push(child);
  return child;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready(url) {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Service not ready: " + url);
}
async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGCONT");
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(10000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
try {
  command([
    ...docker,
    "run",
    "-d",
    "--name",
    container,
    "--env-file",
    ".env.test",
    "-e",
    "POSTGRES_USER=postgres",
    "-e",
    "POSTGRES_DB=postgres",
    "-p",
    "127.0.0.1:55433:5432",
    "--mount",
    `type=bind,src=${resolve("ops/init-databases.sh")},dst=/docker-entrypoint-initdb.d/10-create.sh,readonly`,
    "postgres:16-alpine",
  ]);
  for (let i = 0; i < 60; i++) {
    const r = spawnSync(
      docker[0],
      [...docker.slice(1), "exec", container, "pg_isready", "-U", "postgres"],
      { stdio: "ignore" },
    );
    if (r.status === 0) {
      await sleep(2000);
      break;
    }
    const status = spawnSync(
      docker[0],
      [
        ...docker.slice(1),
        "inspect",
        "--format",
        "{{.State.Running}}",
        container,
      ],
      { encoding: "utf8" },
    );
    if (status.stdout?.trim() === "false") {
      spawnSync(
        docker[0],
        [...docker.slice(1), "logs", "--tail", "30", container],
        { stdio: "inherit" },
      );
      throw new Error("Test PostgreSQL container exited during initialization");
    }
    if (i === 59) throw new Error("Test PostgreSQL not ready");
    await sleep(1000);
  }
  command(
    [node, "node_modules/prisma/build/index.js", "migrate", "deploy"],
    env,
  );
  command([node, "scripts/migrate-services.mjs"], env);
  command([node, "--import", "tsx", "scripts/bootstrap-admin.ts"], env);
  const finance = service("finance", [
    "--import",
    "tsx",
    "services/start-finance.ts",
  ]);
  service("scm", ["--import", "tsx", "services/start-scm.ts"]);
  let app = service("crm", [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3200",
  ]);
  service("worker", ["--import", "tsx", "src/server/worker.ts"]);
  await Promise.all([
    ready(config.APP_ORIGIN + "/api/v1/health"),
    ready(config.FINANCE_API_URL + "/health"),
    ready(config.SCM_API_URL + "/health"),
  ]);
  command(
    [node, "--import", "tsx", "--test", "tests/integration/server.test.ts"],
    { ...env, QA_FINANCE_PID: String(finance.pid) },
  );
  await stop(app);
  app = service("crm-restarted", [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3200",
  ]);
  await ready(config.APP_ORIGIN + "/api/v1/health");
  command([node, "scripts/assert-persistence.mjs"], env);
  command([node, "node_modules/@playwright/test/cli.js", "test"], env);
  console.log(
    "PostgreSQL + CRM + Finance + SCM integration, restart persistence, and browser checks passed.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const child of children.reverse()) await stop(child);
  spawnSync(docker[0], [...docker.slice(1), "rm", "-f", "-v", container], {
    stdio: "ignore",
  });
}
