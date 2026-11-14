import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function rawBody(request: Request, max = 32768) {
  const length = Number(request.headers.get("content-length"));
  if (length > max) throw new HttpError(413, "Permintaan terlalu besar.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Permintaan terlalu besar.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(request: Request, max = 32768): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Gunakan Content-Type application/json.");
  const raw = await rawBody(request, max);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON tidak valid.");
  }
}
export function origin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("APP_ORIGIN is required");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("APP_ORIGIN must use HTTPS");
  return url.origin;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== origin())
    throw new HttpError(
      403,
      "Origin permintaan tidak diizinkan.",
      "INVALID_ORIGIN",
    );
}
export function errorResponse(error: unknown) {
  let status = 500,
    message = "Layanan tidak dapat memproses permintaan. Coba kembali.",
    code = "INTERNAL_ERROR";
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
    code = error.code;
  } else if (error instanceof z.ZodError) {
    status = 422;
    message = error.issues[0]?.message ?? "Input tidak valid.";
    code = "VALIDATION_ERROR";
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      status = 409;
      message = "Data dengan identitas tersebut sudah terdaftar.";
      code = "CONFLICT";
    }
    if (error.code === "P2025") {
      status = 404;
      message = "Data tidak ditemukan.";
      code = "NOT_FOUND";
    }
  }
  if (status === 500)
    console.error("CRM request failed", {
      name: error instanceof Error ? error.name : "Unknown",
    });
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
