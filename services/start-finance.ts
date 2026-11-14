process.env.SERVICE_KIND = "finance";
process.env.PORT = process.env.FINANCE_PORT ?? "4101";
process.env.SERVICE_DATABASE_URL =
  process.env.FINANCE_DATABASE_URL ?? process.env.SERVICE_DATABASE_URL;
void import("./server");
