import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const testing = args[0] === "--test";
const filename = testing ? ".env.test" : ".env";
const host = (testing ? "localhost" : args[0]) ?? "localhost";
if (!/^[a-z0-9.-]+$/i.test(host) || host.includes(".."))
  throw new Error("Pass a valid hostname only.");
if (existsSync(filename))
  throw new Error(filename + " already exists; it will not be overwritten.");
const crmDb = testing ? "crm_test" : "crm",
  financeDb = testing ? "finance_test" : "finance",
  scmDb = testing ? "scm_test" : "scm";
const dbPort = testing ? 55433 : 55432,
  appPort = testing ? 3200 : 3100,
  financePort = testing ? 4201 : 4101,
  scmPort = testing ? 4202 : 4102;
const secret = () => randomBytes(32).toString("hex");
const passwords = {
  postgres: secret(),
  crm: secret(),
  finance: secret(),
  scm: secret(),
};
const text = [
  `APP_ORIGIN=${host === "localhost" ? `http://localhost:${appPort}` : `https://${host}`}`,
  `APP_DOMAIN=${host}`,
  `PORT=${appPort}`,
  `CRM_DATABASE_NAME=${crmDb}`,
  `FINANCE_DATABASE_NAME=${financeDb}`,
  `SCM_DATABASE_NAME=${scmDb}`,
  `FINANCE_PORT=${financePort}`,
  `SCM_PORT=${scmPort}`,
  `POSTGRES_PASSWORD=${passwords.postgres}`,
  `CRM_DB_PASSWORD=${passwords.crm}`,
  `FINANCE_DB_PASSWORD=${passwords.finance}`,
  `SCM_DB_PASSWORD=${passwords.scm}`,
  `DATABASE_URL=postgresql://crm_app:${passwords.crm}@127.0.0.1:${dbPort}/${crmDb}`,
  `FINANCE_DATABASE_URL=postgresql://finance_app:${passwords.finance}@127.0.0.1:${dbPort}/${financeDb}`,
  `SCM_DATABASE_URL=postgresql://scm_app:${passwords.scm}@127.0.0.1:${dbPort}/${scmDb}`,
  `FINANCE_API_URL=http://127.0.0.1:${financePort}`,
  `SCM_API_URL=http://127.0.0.1:${scmPort}`,
  `FINANCE_SERVICE_TOKEN=${secret()}`,
  `SCM_SERVICE_TOKEN=${secret()}`,
  `FINANCE_WEBHOOK_SECRET=${secret()}`,
  `SCM_WEBHOOK_SECRET=${secret()}`,
  `CRM_CALLBACK_BASE_URL=http://127.0.0.1:${appPort}`,
  `BOOTSTRAP_ADMIN_EMAIL=admin@${host === "localhost" ? "localhost.test" : host}`,
  `BOOTSTRAP_ADMIN_PASSWORD=${secret()}`,
  `SERVICE_DATABASE_URL=postgresql://finance_app:${passwords.finance}@127.0.0.1:${dbPort}/${financeDb}`,
  "",
].join("\n");
writeFileSync(filename, text, { mode: 0o600, flag: "wx" });
console.log(
  "Created private .env with new credentials for the databases and services you are provisioning. No external account credentials were assumed.",
);
