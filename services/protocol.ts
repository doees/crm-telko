import { createHmac, timingSafeEqual } from "node:crypto";
export function secret(name: string) {
  const value = process.env[name];
  if (!value || value.length < 32)
    throw new Error(`${name} must contain at least 32 characters`);
  return value;
}
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signature(key: string, timestamp: string, raw: string) {
  return createHmac("sha256", key)
    .update(timestamp + "." + raw)
    .digest("hex");
}
export function validSignature(
  key: string,
  timestamp: string | null,
  supplied: string | null,
  raw: string,
) {
  if (
    !timestamp ||
    !supplied ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000
  )
    return false;
  return equalSecret(signature(key, timestamp, raw), supplied);
}
export function endpoint(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Integration URL must not include credentials or query");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "crm", "finance", "scm"].includes(url.hostname)
    )
  )
    throw new Error("External integration URLs must use HTTPS");
  return url.origin;
}
