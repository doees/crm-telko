process.env.SERVICE_KIND = "scm";
process.env.PORT = process.env.SCM_PORT ?? "4102";
process.env.SERVICE_DATABASE_URL =
  process.env.SCM_DATABASE_URL ?? process.env.SERVICE_DATABASE_URL;
void import("./server");
