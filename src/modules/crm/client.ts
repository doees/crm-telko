"use client";
import type { CrmState, Role, Command } from "./types";
import { emptyState } from "./empty";
export type User = { id: string; name: string; email: string; role: Role };
type View = {
  status: "loading" | "ready" | "signedout" | "error";
  state: CrmState;
  user: User | null;
  csrf: string;
  error: string;
  busy: boolean;
};
const initial: View = {
  status: "loading",
  state: emptyState,
  user: null,
  csrf: "",
  error: "",
  busy: false,
};
let view = initial,
  started = false,
  epoch = 0,
  mutating = false;
const listeners = new Set<() => void>();
const set = (next: View) => {
  view = next;
  listeners.forEach((l) => l());
};
export const getSnapshot = () => view;
export const getServerSnapshot = () => initial;
export async function request(path: string, method = "GET", payload?: unknown) {
  let response: Response;
  try {
    response = await fetch("/api/v1/" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(method === "GET"
          ? {}
          : {
              "X-CSRF-Token": view.csrf,
              "Idempotency-Key": crypto.randomUUID(),
            }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  } catch {
    throw new Error(
      "Respons server belum diterima. Muat ulang untuk memeriksa perubahan.",
    );
  }
  const result = await response.json().catch(() => null);
  if (response.status === 401 && path !== "auth/login") {
    epoch++;
    set({ ...initial, status: "signedout" });
  }
  if (!response.ok)
    throw new Error(
      result?.error?.message ?? "Server tidak dapat memproses permintaan.",
    );
  return result.data;
}
export async function refresh() {
  const current = epoch;
  try {
    const response = await fetch("/api/v1/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (current !== epoch) return;
    if (response.status === 401) {
      set({ ...initial, status: "signedout" });
      return;
    }
    const session = await response.json();
    if (!response.ok)
      throw new Error(session?.error?.message ?? "Sesi tidak dapat diperiksa.");
    const state = (await request("state")) as CrmState;
    if (current !== epoch) return;
    if (
      view.status === "ready" &&
      view.user?.id === session.data.user.id &&
      state.revision < view.state.revision
    )
      return;
    set({
      ...view,
      status: "ready",
      state,
      user: session.data.user,
      csrf: session.data.csrf,
      error: "",
    });
  } catch (error) {
    if (current === epoch)
      set({
        ...view,
        status: "error",
        error: error instanceof Error ? error.message : "Koneksi server gagal.",
      });
  }
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    queueMicrotask(() => void refresh());
  }
  const interval = setInterval(() => {
    if (!document.hidden && !mutating && view.status === "ready")
      void refresh();
  }, 4000);
  const focus = () => {
    if (!mutating) void refresh();
  };
  window.addEventListener("focus", focus);
  return () => {
    listeners.delete(listener);
    clearInterval(interval);
    window.removeEventListener("focus", focus);
  };
}
export async function signIn(email: string, password: string) {
  epoch++;
  const result = await request("auth/login", "POST", { email, password });
  set({ ...view, csrf: result.csrf, user: result.user, status: "loading" });
  await refresh();
}
export async function signOut() {
  await request("auth/logout", "POST", {});
  epoch++;
  set({ ...initial, status: "signedout" });
}
export async function dispatch(command: Command) {
  if (mutating) throw new Error("Tunggu perubahan sebelumnya selesai.");
  mutating = true;
  set({ ...view, busy: true });
  try {
    const next = (await request("commands", "POST", command)) as CrmState;
    set({ ...view, state: next });
  } finally {
    mutating = false;
    set({ ...view, busy: false });
  }
}
export async function operation(path: string, payload: unknown) {
  if (mutating) throw new Error("Tunggu perubahan sebelumnya selesai.");
  mutating = true;
  set({ ...view, busy: true });
  try {
    const result = await request(path, "POST", payload);
    await refresh();
    return result;
  } finally {
    mutating = false;
    set({ ...view, busy: false });
  }
}
