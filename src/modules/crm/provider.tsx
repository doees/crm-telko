"use client";
import { useState, useSyncExternalStore, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleCheck, CircleAlert, X, Radio, RefreshCw } from "lucide-react";
import { CrmContext } from "./context";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  dispatch,
  refresh,
} from "./client";
import type { Command, Modal } from "./types";
import { CrmDialogs } from "@/components/crm/dialogs";
export function CrmProvider({ children }: { children: React.ReactNode }) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const path = usePathname();
  const router = useRouter();
  const [modal, open] = useState<Modal>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const toast = useCallback(
    (message: string, error = false) => setNotice({ message, error }),
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (view.status === "signedout" && path !== "/login")
      router.replace("/login");
  }, [view.status, path, router]);
  async function run(
    command: Command,
    message = "Perubahan berhasil disimpan.",
  ) {
    try {
      await dispatch(command);
      toast(message);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Perubahan gagal.", true);
      return false;
    }
  }
  const context = {
    state: view.state,
    user: view.user,
    busy: view.busy,
    run,
    open,
    modal,
    toast,
  };
  const protectedPage = path !== "/login";
  let content = children;
  if (protectedPage && view.status !== "ready")
    content = (
      <div className="auth-loading">
        <Radio size={36} />
        <h1>
          {view.status === "error"
            ? "Koneksi belum tersedia"
            : "Memuat workspace"}
        </h1>
        <p>
          {view.status === "error"
            ? view.error
            : "Memeriksa sesi dan data layanan…"}
        </p>
        {view.status === "error" && (
          <button className="btn btn-primary" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Coba kembali
          </button>
        )}
      </div>
    );
  return (
    <CrmContext.Provider value={context}>
      {view.busy && <div className="busy-indicator" />}
      {content}
      {protectedPage && view.status === "ready" && <CrmDialogs />}
      {notice && (
        <div
          className={`toast ${notice.error ? "toast-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <CircleAlert size={19} /> : <CircleCheck size={19} />}
          <span>{notice.message}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </CrmContext.Provider>
  );
}
