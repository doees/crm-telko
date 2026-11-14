import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, locked } from "./db";
import { HttpError, sameOrigin, origin, json } from "./http";
import type { Role } from "@/modules/crm/types";
export type Actor = { id: string; name: string; email: string; role: Role };
export const COOKIE = "nusa_session";
export const passwordInput = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128)
  .regex(/[A-Za-z]/, "Password perlu huruf.")
  .regex(/[0-9]/, "Password perlu angka.");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(24).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$32768$${salt}$${key.toString("hex")}`;
}
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}
export async function verifyPassword(password: string, hash: string) {
  const parts = hash.split("$");
  const salt =
    parts.length === 4
      ? parts[2]
      : "0123456789abcdef0123456789abcdef0123456789abcdef";
  const key = await derive(password, salt);
  const expected = Buffer.from(
    parts.length === 4 ? parts[3] : "00".repeat(64),
    "hex",
  );
  return (
    expected.length === key.length &&
    timingSafeEqual(expected, key) &&
    parts[0] === "scrypt" &&
    parts[1] === "32768"
  );
}
function token(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
}
export async function session(request: Request) {
  const value = token(request);
  if (!value || value.length > 200)
    throw new HttpError(401, "Silakan masuk ke akun Anda.", "UNAUTHENTICATED");
  const found = await db().session.findUnique({
    where: { tokenHash: digest(value) },
    include: { user: true },
  });
  if (!found || found.expiresAt < new Date() || !found.user.isActive)
    throw new HttpError(
      401,
      "Sesi berakhir. Silakan masuk kembali.",
      "UNAUTHENTICATED",
    );
  const user: Actor = {
    id: found.user.id,
    name: found.user.name,
    email: found.user.email,
    role: found.user.role,
  };
  return { user, csrf: found.csrfToken, id: found.id };
}
export async function authorize(
  request: Request,
  roles?: Role[],
  mutate = false,
) {
  const current = await session(request);
  if (roles && !roles.includes(current.user.role))
    throw new HttpError(
      403,
      "Akun Anda tidak memiliki izin untuk tindakan ini.",
      "FORBIDDEN",
    );
  if (mutate) {
    sameOrigin(request);
    const csrf = request.headers.get("x-csrf-token") ?? "";
    if (
      Buffer.byteLength(csrf) !== Buffer.byteLength(current.csrf) ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(current.csrf))
    )
      throw new HttpError(
        403,
        "Token keamanan tidak valid. Muat ulang halaman.",
        "INVALID_CSRF",
      );
  }
  return current;
}
export async function login(request: Request, input: unknown) {
  sameOrigin(request);
  const parsed = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .strict()
    .parse(input);
  const email = parsed.email.toLowerCase();
  const key = digest(email);
  const now = new Date();
  await locked(async (tx) => {
    for (const item of [
      { key: "login-global", max: 60, window: 60000 },
      { key, max: 8, window: 15 * 60 * 1000 },
    ]) {
      await tx.loginAttempt.upsert({
        where: { key: item.key },
        create: { key: item.key, count: 0, windowStart: now },
        update: {},
      });
      await tx.$queryRaw`SELECT key FROM "LoginAttempt" WHERE key=${item.key} FOR UPDATE`;
      const previous = await tx.loginAttempt.findUniqueOrThrow({
        where: { key: item.key },
      });
      const expired =
        now.getTime() - previous.windowStart.getTime() >= item.window;
      if (!expired && previous.count >= item.max)
        throw new HttpError(
          429,
          "Terlalu banyak percobaan masuk. Coba lagi nanti.",
          "RATE_LIMITED",
        );
      await tx.loginAttempt.update({
        where: { key: item.key },
        data: expired
          ? { count: 1, windowStart: now }
          : { count: { increment: 1 } },
      });
    }
  });
  const user = await db().user.findUnique({ where: { email } });
  const valid = await verifyPassword(parsed.password, user?.passwordHash ?? "");
  if (!user || !valid || !user.isActive)
    throw new HttpError(
      401,
      "Email atau password tidak sesuai.",
      "INVALID_CREDENTIALS",
    );
  await db().loginAttempt.deleteMany({ where: { key } });
  const value = randomBytes(48).toString("base64url"),
    csrf = randomBytes(32).toString("base64url");
  await db().session.create({
    data: {
      userId: user.id,
      tokenHash: digest(value),
      csrfToken: csrf,
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    },
  });
  const response = json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    csrf,
  });
  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    secure: new URL(origin()).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
export async function logout(request: Request) {
  const current = await authorize(request, undefined, true);
  await db().session.delete({ where: { id: current.id } });
  const response = json({ loggedOut: true });
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: new URL(origin()).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
export async function changePassword(request: Request, input: unknown) {
  const current = await authorize(request, undefined, true);
  const parsed = z
    .object({
      currentPassword: z.string().max(128),
      newPassword: passwordInput,
    })
    .strict()
    .parse(input);
  const user = await db().user.findUniqueOrThrow({
    where: { id: current.user.id },
  });
  if (!(await verifyPassword(parsed.currentPassword, user.passwordHash)))
    throw new HttpError(400, "Password saat ini tidak sesuai.");
  const passwordHash = await hashPassword(parsed.newPassword);
  await db().$transaction([
    db().user.update({ where: { id: user.id }, data: { passwordHash } }),
    db().session.deleteMany({
      where: { userId: user.id, id: { not: current.id } },
    }),
    db().auditLog.create({
      data: { actorId: user.id, action: "PASSWORD_CHANGED", data: {} },
    }),
  ]);
  return json({ changed: true });
}
export async function createUser(actor: Actor, input: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "Hanya administrator dapat mengelola akun.");
  const data = z
    .object({
      email: z.email().max(254),
      name: z.string().trim().min(3).max(80),
      role: z.enum(["ADMIN", "CS", "TECHNICIAN", "MANAGER"]),
      password: passwordInput,
    })
    .strict()
    .parse(input);
  const passwordHash = await hashPassword(data.password);
  return locked(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "USER_CREATED",
        data: { userId: user.id, role: user.role },
      },
    });
    return user;
  });
}
export async function updateUser(actor: Actor, id: string, input: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "Hanya administrator dapat mengelola akun.");
  const data = z
    .object({
      role: z.enum(["ADMIN", "CS", "TECHNICIAN", "MANAGER"]).optional(),
      isActive: z.boolean().optional(),
      newPassword: passwordInput.optional(),
    })
    .strict()
    .parse(input);
  const passwordHash = data.newPassword
    ? await hashPassword(data.newPassword)
    : undefined;
  return locked(async (tx) => {
    const current = await tx.user.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, "Pengguna tidak ditemukan.");
    if (
      current.role === "ADMIN" &&
      current.isActive &&
      ((data.role && data.role !== "ADMIN") || data.isActive === false) &&
      (await tx.user.count({ where: { role: "ADMIN", isActive: true } })) <= 1
    )
      throw new HttpError(
        409,
        "Administrator aktif terakhir tidak dapat dinonaktifkan.",
      );
    const next = await tx.user.update({
      where: { id },
      data: { role: data.role, isActive: data.isActive, passwordHash },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (passwordHash || data.isActive === false)
      await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "USER_UPDATED",
        data: {
          userId: id,
          role: data.role ?? current.role,
          isActive: data.isActive ?? current.isActive,
          passwordReset: Boolean(passwordHash),
        },
      },
    });
    return next;
  });
}
