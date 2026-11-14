const origin = process.env.APP_ORIGIN;
const response = await fetch(origin + "/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  }),
});
if (!response.ok) throw new Error("Login after restart failed");
const cookie = response.headers.get("set-cookie")?.split(";")[0];
const state = await fetch(origin + "/api/v1/state", {
  headers: { Cookie: cookie },
});
const data = await state.json();
if (
  !state.ok ||
  !data.data.customers.some((c) => c.name.startsWith("QA Persistent"))
)
  throw new Error("Data not persisted across server restart");
console.log(
  "Database records and account authentication survive a CRM process restart.",
);
