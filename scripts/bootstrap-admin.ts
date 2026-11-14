import { db } from "../src/server/db";
import { hashPassword, passwordInput } from "../src/server/auth";
import { z } from "zod";
async function main() {
  const email = z
    .email()
    .parse(process.env.BOOTSTRAP_ADMIN_EMAIL)
    .toLowerCase();
  const password = passwordInput.parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  if ((await db().user.count({ where: { role: "ADMIN", isActive: true } })) > 0)
    throw new Error(
      "An administrator already exists. Bootstrap will not overwrite accounts.",
    );
  await db().user.create({
    data: {
      email,
      name: "Administrator",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  await db().workspace.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  console.log(
    "Administrator created. Retrieve the bootstrap email/password from your private .env, log in, and change the password.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed");
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
